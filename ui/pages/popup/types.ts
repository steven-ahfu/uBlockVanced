export interface Counts {
    any: number;
    script: number;
    frame: number;
}

export interface HostnameEntry {
    domain: string;
    counts: { allowed: Counts; blocked: Counts };
}

// Subset of the object returned by { what: 'getPopupData' } that the popup
// reads. Everything else is passed through untouched.
export interface PopupData {
    tabId: number;
    pageURL: string;
    rawURL: string;
    pageHostname: string;
    pageDomain: string;
    tabTitle?: string;
    appName: string;
    appVersion: string;
    netFilteringSwitch: boolean;
    advancedUserEnabled: boolean;
    matrixIsDirty: boolean;
    canElementPicker: boolean;
    userFiltersAreEnabled: boolean;
    noPopups: boolean;
    noLargeMedia: boolean;
    noCosmeticFiltering: boolean;
    noRemoteFonts: boolean;
    noScripting: boolean;
    popupBlockedCount: number;
    largeMediaCount: number;
    remoteFontCount: number;
    hasUnprocessedRequest: boolean;
    colorBlindFriendly: boolean;
    firewallPaneMinimized: boolean;
    firewallRules: Record<string, string | undefined>;
    hostnameDict: Record<string, HostnameEntry>;
    cnameMap: Array<[string, string]> | Map<string, string>;
    contentLastModified: number;
    popupPanelSections: number;
    popupPanelDisabledSections?: number;
    popupPanelLockedSections?: number;
    popupPanelHeightMode?: number;
    popupPanelOrientation?: string;
    uiPopupConfig?: string;
    tooltipsDisabled?: boolean;
    fontSize?: string;
    godMode?: boolean;
    [key: string]: unknown;
}

export type SwitchName =
    | 'no-popups'
    | 'no-large-media'
    | 'no-cosmetic-filtering'
    | 'no-remote-fonts'
    | 'no-scripting';

export type RuleAction = 0 | 1 | 2 | 3; // unset, block, allow, noop
export type RuleScope = '/' | '.';

export interface FilterExpressions {
    notA: boolean;
    blocked: boolean;
    allowed: boolean;
    notB: boolean;
    script: boolean;
    frame: boolean;
}
