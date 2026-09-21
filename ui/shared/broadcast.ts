// Listen to the extension-wide 'uBO' BroadcastChannel the background uses
// (src/js/broadcast.js). Returns a disposer for use in effects.

export interface BroadcastMessage extends Record<string, unknown> { what: string }

export function onBroadcast(listener: (msg: BroadcastMessage) => void): () => void {
    const bc = new BroadcastChannel('uBO');
    bc.onmessage = ev => { listener((ev.data || {}) as BroadcastMessage); };
    return () => { bc.close(); };
}
