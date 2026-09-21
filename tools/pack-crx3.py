#!/usr/bin/env python3
"""
Pack a Chrome extension directory into CRX3 format.

Uses the `openssl` CLI for key generation and signing so the only
requirements are Python 3 and OpenSSL. Generates a new RSA-2048 key or
reuses an existing .pem; keep the .pem to preserve the extension ID.

Usage:
    pack-crx3.py <src_dir> <zip_path> <crx_path> [pem_path]

Pass "-" as zip_path to skip writing the intermediate zip.
"""
import hashlib
import io
import os
import struct
import subprocess
import sys
import zipfile

if len(sys.argv) < 4:
    raise SystemExit(__doc__)

src_dir  = sys.argv[1]  # e.g. dist/build/uBlock0.chromium
zip_path = sys.argv[2]  # e.g. dist/build/uBlockVanced.zip, or "-" to skip
crx_path = sys.argv[3]  # e.g. dist/build/uBlockVanced.crx
pem_path = sys.argv[4] if len(sys.argv) > 4 else "uBlockVanced.pem"


def openssl(*args, data=None):
    return subprocess.run(
        ["openssl", *args], input=data, capture_output=True, check=True
    ).stdout


# ---------- key ----------
if os.path.exists(pem_path):
    print(f"Reusing key: {pem_path}")
else:
    print(f"Generating new RSA-2048 key -> {pem_path}")
    pem = openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048")
    with open(pem_path, "wb") as f:
        f.write(pem)
    print(f"Key saved to {pem_path} — keep this file to preserve extension ID!")

# ---------- build ZIP ----------
print("Building ZIP payload")
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in sorted(os.walk(src_dir)):
        # Skip hidden dirs
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        for fname in sorted(files):
            fpath = os.path.join(root, fname)
            arcname = os.path.relpath(fpath, src_dir).replace("\\", "/")
            zf.write(fpath, arcname)
zip_bytes = buf.getvalue()

if zip_path != "-":
    os.makedirs(os.path.dirname(os.path.abspath(zip_path)), exist_ok=True)
    with open(zip_path, "wb") as f:
        f.write(zip_bytes)
    print(f"  ZIP written: {zip_path}")
print(f"  ZIP size: {len(zip_bytes):,} bytes")

# ---------- build CRX3 header ----------
# DER-encoded SubjectPublicKeyInfo
pub_der = openssl("pkey", "-in", pem_path, "-pubout", "-outform", "DER")

# crx_id = first 16 bytes of SHA-256 of DER public key
crx_id = hashlib.sha256(pub_der).digest()[:16]


# SignedData protobuf: field 1 (crx_id) = bytes
def encode_varint(n):
    parts = []
    while n > 0x7F:
        parts.append((n & 0x7F) | 0x80)
        n >>= 7
    parts.append(n)
    return bytes(parts)


def encode_bytes_field(field_num, data):
    tag = encode_varint(field_num << 3 | 2)
    return tag + encode_varint(len(data)) + data


signed_data_proto = encode_bytes_field(1, crx_id)

# Payload to sign = magic prefix + LE32(len(signed_data)) + signed_data + zip
signed_payload = (
    b"CRX3 SignedData\x00"
    + struct.pack("<I", len(signed_data_proto))
    + signed_data_proto
    + zip_bytes
)

# RSA PKCS#1 v1.5 over SHA-256
signature = openssl("dgst", "-sha256", "-sign", pem_path, data=signed_payload)

# AsymmetricKeyProof: field 1 = pubkey bytes, field 2 = signature bytes
key_proof_proto = (
    encode_bytes_field(1, pub_der) +
    encode_bytes_field(2, signature)
)

# CrxFileHeader: field 2 = AsymmetricKeyProof (sha256_with_rsa),
# field 10000 = SignedData
crx_header_proto = (
    encode_bytes_field(2, key_proof_proto) +
    encode_bytes_field(10000, signed_data_proto)
)

# CRX3 binary: magic + version(3) + header_size + header + zip
crx_bytes = (
    b"Cr24"
    + struct.pack("<I", 3)
    + struct.pack("<I", len(crx_header_proto))
    + crx_header_proto
    + zip_bytes
)

os.makedirs(os.path.dirname(os.path.abspath(crx_path)), exist_ok=True)
with open(crx_path, "wb") as f:
    f.write(crx_bytes)

ext_id = "".join(
    chr(ord("a") + (b >> 4)) + chr(ord("a") + (b & 0x0F)) for b in crx_id
)
print(f"  CRX size: {len(crx_bytes):,} bytes")
print(f"  Extension ID: {ext_id}")
print(f"CRX3 written: {crx_path}")

# Verify magic and signature round-trip
with open(crx_path, "rb") as f:
    assert f.read(4) == b"Cr24", "Bad magic"
    ver = struct.unpack("<I", f.read(4))[0]
    assert ver == 3, f"Bad version: {ver}"
pub_pem = openssl("pkey", "-in", pem_path, "-pubout")
with open(crx_path + ".sig", "wb") as f:
    f.write(signature)
with open(crx_path + ".pub", "wb") as f:
    f.write(pub_pem)
try:
    openssl("dgst", "-sha256", "-verify", crx_path + ".pub",
            "-signature", crx_path + ".sig", data=signed_payload)
finally:
    os.remove(crx_path + ".sig")
    os.remove(crx_path + ".pub")
print("CRX3 header and signature verified OK")
