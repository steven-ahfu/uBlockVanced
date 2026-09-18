// Shapes of the `getLists` response (src/js/messaging.js) and of the
// broadcast messages the Filter lists page reacts to.

export interface ListDetails {
    title?: string;
    group?: string;
    group2?: string;
    parent?: string;
    off?: boolean;
    external?: boolean;
    supportName?: string;
    supportURL?: string;
    instructionURL?: string;
    isDefault?: boolean;
    isImportant?: boolean;
    preferred?: boolean;
    entryCount?: number;
    entryUsedCount?: number;
    content?: string;
    contentURL?: string | string[];
    tags?: string;
}

export interface AssetCache {
    remoteURL?: string;
    error?: unknown;
    obsolete?: boolean;
    cached?: boolean;
    writeTime?: number;
}

export interface FilterListDiff {
    addedCount?: number;
    removedCount?: number;
    modifiedCount?: number;
    added?: string[];
    removed?: string[];
    modified?: Array<{ before: string; after: string }>;
    truncated?: boolean;
}

export interface ListsetDetails {
    autoUpdate: boolean;
    available: Record<string, ListDetails>;
    cache: Record<string, AssetCache>;
    cosmeticFilterCount: number;
    current: Record<string, ListDetails>;
    ignoreGenericCosmeticFilters: boolean;
    isUpdating: boolean;
    netFilterCount: number;
    parseCosmeticFilters: boolean;
    suspendUntilListsAreLoaded: boolean;
    userFiltersPath: string;
    filterListDiffs?: Record<string, FilterListDiff>;
}

export interface AssetUpdatedMessage {
    what: 'assetUpdated';
    key: string;
    cached?: boolean;
    failed?: boolean;
}

// Cloud storage bridge contract shared with ui/shared/CloudWidget.tsx.
export interface CloudData {
    parseCosmeticFilters?: boolean;
    ignoreGenericCosmeticFilters?: boolean;
    selectedLists?: string[];
}
