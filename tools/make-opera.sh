#!/usr/bin/env bash
#
# This script assumes a linux environment

set -euo pipefail

echo "*** uBlock0.opera: Creating web store package"

BLDIR="dist/build"
DES="$BLDIR/uBlock0.opera"
rm -rf "$DES"
mkdir -p "$DES"

echo "*** uBlock0.opera: Copying common files"
bash ./tools/copy-common-files.sh $DES

# Chromium-specific
echo "*** uBlock0.opera: Copying chromium-specific files"
cp platform/chromium/*.js   $DES/js/
cp platform/chromium/*.html $DES/

# Opera-specific
echo "*** uBlock0.opera: Copying opera-specific files"
cp platform/opera/manifest.json $DES/

# Locales not accepted by the Opera add-ons store. Some of these no longer
# exist in src/_locales, so tolerate missing directories.
for locale in az be cv gu hi hy ka kk ku mr si so th; do
    rm -rf "$DES/_locales/$locale"
done

# Removing WASM modules until I receive an answer from Opera people: Opera's
# uploader issue an error for hntrie.wasm and this prevents me from
# updating uBO in the Opera store. The modules are unused anyway for
# Chromium- based browsers.
rm $DES/js/wasm/*.wasm
rm $DES/js/wasm/*.wat
rm $DES/lib/lz4/*.wasm
rm $DES/lib/lz4/*.wat
rm $DES/lib/publicsuffixlist/wasm/*.wasm
rm $DES/lib/publicsuffixlist/wasm/*.wat

echo "*** uBlock0.opera: Generating meta..."
python3 tools/make-opera-meta.py $DES/

if [ "${1:-}" = "all" ]; then
    echo "*** uBlock0.opera: Creating plain package..."
    pushd "$(dirname "$DES/")" > /dev/null
    zip "uBlockVanced.opera.zip" -qr "$(basename "$DES/")"/*
    popd > /dev/null
elif [ -n "${1:-}" ]; then
    echo "*** uBlock0.opera: Creating versioned package..."
    pushd "$(dirname "$DES/")" > /dev/null
    zip "uBlockVanced-$1.opera.zip" -qr "$(basename "$DES/")"/*
    popd > /dev/null
fi

echo "*** uBlock0.opera: Package done."
