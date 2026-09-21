import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../shared/i18n';
import { send } from '../../shared/vapi';
import { setAccentColor, setTheme } from '../../../src/js/theme.js';

declare global {
    interface Window {
        hasUnsavedData?: () => boolean;
        wikilink?: string;
    }
}

// The `userSettings` response: every user setting by name, plus the two
// capability flags messaging.js adds.
export type UserSettings = Record<string, unknown> & {
    canLeakLocalIPAddresses?: boolean;
    cnameUncloakEnabled?: boolean;
};

export interface LocalData {
    storageUsed?: number;
    lastBackupFile?: string;
    lastBackupTime?: number;
    lastRestoreFile?: string;
    lastRestoreTime?: number;
    cloudStorageSupported?: boolean;
    privacySettingsSupported?: boolean;
}

export interface SettingsState {
    settings: UserSettings | null;
    local: LocalData | null;
    storageText: string;
    lastBackupText: string;
    lastRestoreText: string;
}

export interface SettingsActions {
    /** True when the background did not report this setting at all. */
    unsupported(name: string): boolean;
    /** Disabled by a capability flag (cloud storage, privacy settings). */
    disabled(name: string): boolean;
    bool(name: string): boolean;
    value(name: string): string;
    setBool(name: string, value: boolean): void;
    setValue(name: string, value: string): void;
    backup(): Promise<void>;
    restoreFile(file: File): void;
    reset(): void;
}

const timeOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: 'numeric', timeZoneName: 'short',
};

function locale(): string[] | undefined {
    return Array.isArray(navigator.languages) && navigator.languages.length !== 0
        ? navigator.languages as string[]
        : undefined;
}

// Upstream onLocalDataReceived(): "Storage used: 1.23 MB".
function storageUsedText(used: number | undefined): string {
    let v: number | string;
    let unit: string;
    if ( typeof used === 'number' ) {
        v = used;
        if ( v < 1e3 ) { unit = 'genericBytes'; }
        else if ( v < 1e6 ) { v /= 1e3; unit = 'KB'; }
        else if ( v < 1e9 ) { v /= 1e6; unit = 'MB'; }
        else { v /= 1e9; unit = 'GB'; }
        v = v.toLocaleString(undefined, { maximumSignificantDigits: 3 });
    } else {
        v = '?';
        unit = '';
    }
    return t('storageUsed')
        .replace('{{value}}', v)
        .replace('{{unit}}', unit !== '' ? t(unit) : '');
}

function stampText(promptKey: string, file: string | undefined, time: number | undefined): string {
    if ( !file ) { return ''; }
    return t(promptKey) + '\xA0' + new Date(time ?? 0).toLocaleString(locale(), timeOptions);
}

export function useSettings(): [ SettingsState, SettingsActions ] {
    const [ settings, setSettings ] = useState<UserSettings | null>(null);
    const [ local, setLocal ] = useState<LocalData | null>(null);
    const latest = useRef(settings);
    latest.current = settings;

    useEffect(() => {
        self.wikilink = 'https://github.com/gorhill/uBlock/wiki/Dashboard:-Settings';
        self.hasUnsavedData = () => false;
        send<UserSettings | null>('dashboard', { what: 'userSettings' })
            .then(result => { if ( result instanceof Object ) { setSettings(result); } }, () => {});
        send<LocalData | null>('dashboard', { what: 'getLocalData' })
            .then(result => { if ( result instanceof Object ) { setLocal(result); } }, () => {});
    }, []);

    // Upstream synchronizeDOM(): body.advancedUser mirrors the setting.
    useEffect(() => {
        document.body.classList.toggle('advancedUser', settings?.advancedUserEnabled === true);
    }, [ settings ]);

    const unsupported = useCallback((name: string) =>
        settings === null || settings[name] === undefined, [ settings ]);

    const disabled = useCallback((name: string) => {
        if ( unsupported(name) ) { return true; }
        if ( local === null ) { return false; }
        if ( name === 'cloudStorageEnabled' ) { return local.cloudStorageSupported === false; }
        if ( name === 'prefetchingDisabled' || name === 'hyperlinkAuditingDisabled' || name === 'webrtcIPAddressHidden' ) {
            return local.privacySettingsSupported === false;
        }
        return false;
    }, [ unsupported, local ]);

    const bool = useCallback((name: string) => settings?.[name] === true, [ settings ]);
    const value = useCallback((name: string) => {
        const v = settings?.[name];
        return v === undefined || v === null ? '' : String(v);
    }, [ settings ]);

    // Upstream changeUserSettings(): persist, then reflect theme/accent at once.
    const change = useCallback((name: string, v: unknown) => {
        const next: UserSettings = { ...(latest.current ?? {}), [name]: v };
        latest.current = next;
        setSettings(next);
        send('dashboard', { what: 'userSettings', name, value: v });
        switch ( name ) {
        case 'uiTheme':
            setTheme(String(v), true);
            break;
        case 'uiAccentCustom':
        case 'uiAccentCustom0':
            setAccentColor(next.uiAccentCustom === true, String(next.uiAccentCustom0 ?? '#000000'), true);
            break;
        default:
            break;
        }
    }, []);

    const setBool = useCallback((name: string, v: boolean) => { change(name, v); }, [ change ]);

    const setValue = useCallback((name: string, raw: string) => {
        let v: string | number = raw;
        if ( name === 'largeMediaSize' ) {
            v = Math.min(Math.max(Math.floor(parseInt(raw, 10) || 0), 0), 1000000);
        }
        change(name, v);
    }, [ change ]);

    const backup = useCallback(async () => {
        const response = await send<{ userData?: object; localData?: LocalData } | null>('dashboard', { what: 'backupUserData' });
        if ( response instanceof Object === false || response.userData instanceof Object === false ) { return; }
        vAPI.download({
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(response.userData, null, '  ')),
            filename: response.localData?.lastBackupFile ?? '',
        });
        if ( response.localData ) { setLocal(response.localData); }
    }, []);

    // Upstream handleImportFilePicker(): validate, confirm, restore.
    const restoreFile = useCallback((file: File) => {
        if ( file.name === '' ) { return; }
        const reportError = () => { window.alert(t('aboutRestoreDataError')); };
        if ( [ 'text/plain', 'application/json' ].includes(file.type) === false ) { reportError(); return; }
        const fr = new FileReader();
        fr.onload = () => {
            let userData: Record<string, unknown> | undefined;
            try {
                const parsed = JSON.parse(String(fr.result));
                if ( typeof parsed !== 'object' || parsed === null ) { throw new Error('Invalid'); }
                if ( typeof parsed.userSettings !== 'object' ) { throw new Error('Invalid'); }
                if ( Array.isArray(parsed.whitelist) === false && typeof parsed.netWhitelist !== 'string' ) { throw new Error('Invalid'); }
                if ( typeof parsed.filterLists !== 'object' && Array.isArray(parsed.selectedFilterLists) === false ) { throw new Error('Invalid'); }
                userData = parsed;
            } catch {
                userData = undefined;
            }
            if ( userData === undefined ) { reportError(); return; }
            const time = new Date(userData.timeStamp as number);
            const msg = t('aboutRestoreDataConfirm').replace('{{time}}', time.toLocaleString());
            if ( window.confirm(msg) !== true ) { return; }
            send('dashboard', { what: 'restoreUserData', userData, file: file.name });
        };
        fr.readAsText(file);
    }, []);

    const reset = useCallback(() => {
        if ( window.confirm(t('aboutResetDataConfirm')) !== true ) { return; }
        send('dashboard', { what: 'resetUserData' });
    }, []);

    const state: SettingsState = {
        settings,
        local,
        storageText: local === null ? '' : storageUsedText(local.storageUsed),
        lastBackupText: local === null ? '' : stampText('settingsLastBackupPrompt', local.lastBackupFile, local.lastBackupTime),
        lastRestoreText: local === null ? '' : stampText('settingsLastRestorePrompt', local.lastRestoreFile, local.lastRestoreTime),
    };
    const actions: SettingsActions = { unsupported, disabled, bool, value, setBool, setValue, backup, restoreFile, reset };
    return [ state, actions ];
}
