// Typed wrappers over the upstream vAPI globals. Nothing here talks to the
// browser directly; everything goes through the same channels the upstream
// pages use so src/js/messaging.js needs no React-specific handlers.

export type Message = Record<string, unknown> & { what: string };

export function send<T = unknown>(channel: string, msg: Message): Promise<T> {
    return vAPI.messaging.send(channel, msg) as Promise<T>;
}

export const storage = {
    get<T = unknown>(key: string): Promise<T | null> {
        return vAPI.localStorage.getItemAsync(key) as Promise<T | null>;
    },
    set(key: string, value: unknown): void {
        vAPI.localStorage.setItem(key, value);
    },
    remove(key: string): void {
        vAPI.localStorage.removeItem(key);
    },
};

export const closePopup = (): void => { vAPI.closePopup(); };
export const isMobile = (): boolean => vAPI.webextFlavor.soup.has('mobile');
export const isFirefox = (): boolean => vAPI.webextFlavor.soup.has('firefox');
