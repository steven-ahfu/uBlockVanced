/*******************************************************************************

    uBlockVanced - Element Probe: the panel's engine.

    One store holding everything the upstream panel kept in
    src/js/element-probe/state.js, with the actions that inspect.js, ui.js,
    picker.js, frames.js and history.js used to drive through document.
    getElementById(). The page-context scripts are imported from
    src/js/element-probe/page-scripts.js and evaluated unchanged.

    This page is the documented exception to "no chrome.* outside vapi":
    chrome.devtools.* has no vAPI wrapper (see AGENTS.md). The global is cast
    once, to the shape declared in globals.d.ts.

*/

import {
    DEFAULT_CLASS_PATTERNS,
    HIDE_ELEMENT_SCRIPT,
    HIGHLIGHT_SCRIPT,
    PICK_ELEMENT_SCRIPT,
    PROCEDURAL_HIGHLIGHT_SCRIPT,
    REMOVE_HIGHLIGHT_SCRIPT,
    SCAN_SHADOW_SCRIPT,
    YT_SWEEP_SCRIPT,
    buildInspectScript,
} from '../../../src/js/element-probe/page-scripts.js';
import {
    FRAME_SCAN_SCRIPT, PROCEDURAL_RE, collisionsOf, frameLabel, generateFilter,
    matchCountScript, selectionSummaryOf, unhideScript,
} from './model';
import type {
    Collision, FrameEntry, HistoryEntry, InspectedData, LogEntry, LogTone,
    ProceduralEntry, RuleType, SelectorEntry, StatusTone,
} from './model';
import { useEffect, useSyncExternalStore } from 'react';
import { t } from '../../shared/i18n';

/******************************************************************************/

const api = chrome as unknown as ProbeChrome;

const HISTORY_KEY = 'elementProbe_filterHistory';
const MAX_LOG_ENTRIES = 120;
const MATCH_COUNT_DELAY = 250;
const SELECTION_DELAY = 120;
const COPIED_DELAY = 1500;
const TEST_REVERT_DELAY = 5000;

// Same string the upstream panel logs and prints next to its title.
export const PANEL_VERSION = '0.3.1';

export type BusyKey =
    'apply' | 'iframes' | 'inspect' | 'pick' | 'preview' | 'shadow' | 'test' |
    'youtube';

export interface ProbeStatus { text: string; tone: StatusTone }

export interface ProbeState {
    busy: Partial<Record<BusyKey, string>>;
    copied: boolean;
    data: InspectedData | null;
    domains: string;
    domainsAuto: boolean;
    filterText: string;
    frameUrl: string;
    frames: FrameEntry[];
    helpOpen: boolean;
    history: HistoryEntry[];
    historySearch: string;
    hostname: string;
    isHighlighting: boolean;
    isYouTube: boolean;
    livePreview: boolean;
    log: LogEntry[];
    /** null while a procedural rule is in the box, undefined when unknown. */
    matchCount: number | null | undefined;
    pageUrl: string;
    procedural: ProceduralEntry[];
    ruleType: RuleType;
    selectedProceduralIndex: number;
    selectedSelectorIndex: number;
    selectionSummary: string;
    selectors: SelectorEntry[];
    status: ProbeStatus;
    styleValue: string;
}

const initialState: ProbeState = {
    busy: {},
    copied: false,
    data: null,
    domains: '',
    domainsAuto: true,
    filterText: '',
    frameUrl: '',
    frames: [],
    helpOpen: false,
    history: [],
    historySearch: '',
    hostname: '',
    isHighlighting: false,
    isYouTube: false,
    livePreview: true,
    log: [],
    matchCount: undefined,
    pageUrl: '',
    procedural: [],
    ruleType: '##',
    selectedProceduralIndex: -1,
    selectedSelectorIndex: -1,
    selectionSummary: '',
    selectors: [],
    status: { text: '', tone: 'idle' },
    styleValue: '',
};

// The three action states syncFilterActions() used to write onto the buttons.
export function filterActionsDisabled(state: ProbeState): Record<string, boolean> {
    const value = state.filterText.trim();
    const procedural = PROCEDURAL_RE.test(value);
    return {
        apply: value === '',
        clear: state.isHighlighting === false,
        copy: value === '',
        preview: value === '' || (procedural && /:remove\(\)/.test(value)),
    };
}

const isValidCssSelector = (selector: string): boolean => {
    try {
        document.createDocumentFragment().querySelector(selector);
        return true;
    } catch { return false; }
};

const errorText = (error: unknown): string =>
    error instanceof Error && error.message ? error.message : String(error);

/******************************************************************************/

export class ProbeStore {
    // Set by the filter card: selects the filter text when the clipboard is
    // refused, as the upstream copy handler did.
    selectOutput: (() => void) | null = null;

    private classPatterns: string[] = DEFAULT_CLASS_PATTERNS;
    private closed = false;
    private copiedTimer = 0;
    private listeners = new Set<() => void>();
    private logSeq = 0;
    private matchTimer = 0;
    private selectionTimer = 0;
    private started = false;
    private state: ProbeState = initialState;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };

    getSnapshot = (): ProbeState => this.state;

    private patch(next: Partial<ProbeState>): void {
        this.state = { ...this.state, ...next };
        for ( const listener of this.listeners ) { listener(); }
    }

    /**************************************************************************/
    // state.js

    private setStatus(text: string, tone: StatusTone = 'idle'): void {
        if ( this.closed ) { return; }
        this.patch({ status: { text, tone } });
    }

    private setSelectionSummary(text: string): void {
        this.patch({ selectionSummary: text });
    }

    private setBusy(key: BusyKey, label?: string): void {
        const busy = { ...this.state.busy };
        if ( label === undefined ) { delete busy[key]; } else { busy[key] = label; }
        this.patch({ busy });
    }

    log(message: string, tone: LogTone = ''): void {
        if ( this.closed ) { return; }
        const entry: LogEntry = {
            id: this.logSeq += 1,
            text: `[${new Date().toLocaleTimeString()}] ${message}`,
            tone,
        };
        const log = this.state.log.concat(entry);
        while ( log.length > MAX_LOG_ENTRIES ) { log.shift(); }
        this.patch({ log });
    }

    clearLog(): void {
        this.patch({ log: [] });
        this.log('Activity log cleared', 'info');
    }

    /**************************************************************************/
    // inspect.js

    evalInPage = (code: string, frameUrl?: string): Promise<unknown> => {
        const targetFrame = frameUrl !== undefined ? frameUrl : this.state.frameUrl;
        const options = targetFrame ? { frameURL: targetFrame } : undefined;
        return new Promise((resolve, reject) => {
            api.devtools.inspectedWindow.eval(code, options, (result, error) => {
                if ( error ) { reject(error); } else { resolve(result); }
            });
        });
    };

    async inspectSelected(): Promise<void> {
        this.setStatus('Inspecting...', 'active');
        this.setBusy('inspect', 'Inspecting...');
        this.log('Inspecting selected element...', 'info');
        try {
            const raw = await this.evalInPage(buildInspectScript(this.classPatterns));
            if ( this.closed ) { return; }
            let data: InspectedData;
            try { data = JSON.parse(raw as string) as InspectedData; } catch {
                this.log('Inspector payload was not valid JSON (page may have navigated mid-scan)', 'error');
                this.setStatus('Error', 'error');
                return;
            }
            if ( !data || typeof data !== 'object' ) {
                this.log('Inspector returned no data', 'error');
                this.setStatus('Error', 'error');
                return;
            }
            if ( data.error ) {
                this.log(data.error, 'error');
                this.setStatus('Error', 'error');
                return;
            }
            data.selectors = Array.isArray(data.selectors) ? data.selectors : [];
            data.proceduralFilters = Array.isArray(data.proceduralFilters) ? data.proceduralFilters : [];
            if ( Array.isArray(data.classes) === false ) { data.classes = []; }
            if ( !data.attrs || typeof data.attrs !== 'object' ) { data.attrs = {}; }
            const hostname = (data.hostname || '').replace(/^www\./, '');
            const autofill = this.state.domains === '' || this.state.domainsAuto;
            this.patch({
                data,
                domains: autofill ? hostname : this.state.domains,
                domainsAuto: autofill ? true : this.state.domainsAuto,
                hostname,
                pageUrl: data.pageUrl || '',
                procedural: data.proceduralFilters,
                selectedProceduralIndex: -1,
                selectedSelectorIndex: -1,
                selectionSummary: selectionSummaryOf(data),
                selectors: data.selectors,
                status: { text: 'Element inspected', tone: 'active' },
            });
            if ( data.selectors.length !== 0 ) { this.selectSelector(0); }
            else { this.syncFilterActions(); }
            this.log(`Inspected <${data.tag}> - ${data.selectors.length} selectors, ${data.proceduralFilters.length} procedural filters`, 'success');
        } catch ( error ) {
            if ( this.closed ) { return; }
            this.log('Inspection failed: ' + errorText(error), 'error');
            this.setStatus('Error', 'error');
        } finally {
            this.setBusy('inspect');
        }
    }

    private resetInspectionState(): void {
        this.patch({
            data: null,
            filterText: '',
            frameUrl: '',
            frames: [],
            isHighlighting: false,
            procedural: [],
            selectedProceduralIndex: -1,
            selectedSelectorIndex: -1,
            selectors: [],
            selectionSummary: t('epNoElementSelected'),
        });
    }

    /**************************************************************************/
    // ui.js

    private filterInputs(over: Partial<ProbeState> = {}) {
        const state = { ...this.state, ...over };
        return {
            domains: state.domains,
            hostname: state.hostname,
            ruleType: state.ruleType,
            styleValue: state.styleValue,
        };
    }

    // The imperative half of syncFilterActions(): the button and hint states
    // are derived in the tree, only the match count has to be fetched.
    private syncFilterActions(): void {
        if ( this.matchTimer !== 0 ) { self.clearTimeout(this.matchTimer); this.matchTimer = 0; }
        const value = this.state.filterText.trim();
        if ( value === '' ) { this.patch({ matchCount: undefined }); return; }
        const procedural = PROCEDURAL_RE.test(value);
        this.matchTimer = self.setTimeout(() => {
            this.matchTimer = 0;
            void this.updateMatchCount(value, procedural);
        }, MATCH_COUNT_DELAY);
    }

    private async updateMatchCount(value: string, procedural: boolean): Promise<void> {
        if ( this.closed ) { return; }
        const match = value.match(/(?:##|#@#)(.+)$/);
        if ( match === null ) { this.patch({ matchCount: undefined }); return; }
        let count: number | null = null;
        if ( procedural === false ) {
            try { count = Number(await this.evalInPage(matchCountScript(match[1]))); }
            catch { count = -1; }
        }
        if ( this.closed ) { return; }
        this.patch({ matchCount: count });
    }

    private setHighlighting(value: boolean): void {
        this.patch({ isHighlighting: value });
        this.syncFilterActions();
    }

    selectSelector(index: number): void {
        const sel = this.state.selectors[index];
        if ( sel === undefined ) { return; }
        this.patch({
            filterText: generateFilter(sel, this.filterInputs()),
            selectedProceduralIndex: -1,
            selectedSelectorIndex: index,
        });
        if ( sel.matches !== -1 ) {
            void this.evalInPage(HIGHLIGHT_SCRIPT(sel.selector));
            this.patch({ isHighlighting: true });
        }
        this.syncFilterActions();
    }

    selectProcedural(index: number): void {
        const pf = this.state.procedural[index];
        if ( pf === undefined ) { return; }
        this.patch({
            filterText: (this.state.hostname || '*') + '##' + pf.filter,
            selectedProceduralIndex: index,
            selectedSelectorIndex: -1,
        });
        void this.evalInPage(REMOVE_HIGHLIGHT_SCRIPT);
        this.setHighlighting(false);
    }

    // Hovering a selector row highlights it in the page, as the upstream
    // mouseenter/mouseleave handlers did.
    hoverSelector(sel: SelectorEntry): void {
        if ( this.state.livePreview && sel.matches !== -1 ) {
            void this.evalInPage(HIGHLIGHT_SCRIPT(sel.selector));
        }
    }

    leaveSelector(): void {
        if ( this.state.isHighlighting === false ) {
            void this.evalInPage(REMOVE_HIGHLIGHT_SCRIPT);
        }
    }

    /**************************************************************************/
    // The filter-output fields

    setFilterText(value: string): void {
        this.patch({ filterText: value });
        this.syncFilterActions();
    }

    setDomains(value: string): void {
        const sel = this.state.selectors[this.state.selectedSelectorIndex];
        const over = { domains: value, domainsAuto: false };
        this.patch(sel !== undefined
            ? { ...over, filterText: generateFilter(sel, this.filterInputs(over)) }
            : over);
    }

    setRuleType(value: RuleType): void {
        const sel = this.state.selectors[this.state.selectedSelectorIndex];
        const over = { ruleType: value };
        this.patch(sel !== undefined
            ? { ...over, filterText: generateFilter(sel, this.filterInputs(over)) }
            : over);
        this.syncFilterActions();
    }

    setStyleValue(value: string): void {
        const sel = this.state.selectors[this.state.selectedSelectorIndex];
        const over = { styleValue: value };
        this.patch(this.state.ruleType === '##-style' && sel !== undefined
            ? { ...over, filterText: generateFilter(sel, this.filterInputs(over)) }
            : over);
    }

    setLivePreview(value: boolean): void { this.patch({ livePreview: value }); }

    setHelpOpen(value: boolean): void { this.patch({ helpOpen: value }); }

    /**************************************************************************/
    // picker.js

    async inspectPoint(): Promise<void> {
        this.setStatus('Pick mode active', 'active');
        this.setBusy('pick', 'Pick mode active');
        this.log(this.state.frameUrl
            ? 'Hover over an element inside the iframe and click to select. Press Escape to cancel.'
            : 'Hover over an element and click to select. Press Escape to cancel.', 'info');
        try {
            const result = await this.evalInPage(PICK_ELEMENT_SCRIPT);
            if ( result === 'already_active' ) { this.log('Picker already active on page', 'info'); return; }
            this.log('Picker injected. Click an element on the page.', 'info');
        } catch ( error ) {
            this.log('Failed to enter pick mode: ' + errorText(error), 'error');
            this.setStatus('Error', 'error');
        } finally { this.setBusy('pick'); }
    }

    async scanShadow(): Promise<void> {
        this.setStatus('Scanning shadow DOM...', 'active');
        this.setBusy('shadow', 'Scanning...');
        this.log('Scanning for shadow DOM hosts...', 'info');
        try {
            const hosts = JSON.parse(await this.evalInPage(SCAN_SHADOW_SCRIPT) as string) as Array<{ childCount: number; host: string }>;
            if ( hosts.length === 0 ) { this.log('No shadow DOM hosts found on this page', 'info'); }
            else {
                this.log(`Found ${hosts.length} shadow DOM host(s):`, 'success');
                hosts.forEach(host => this.log(`  ${host.host} (${host.childCount} children)`, 'info'));
            }
            this.setStatus('Scan complete', 'active');
        } catch ( error ) {
            this.log('Shadow scan failed: ' + String(error), 'error');
            this.setStatus('Error', 'error');
        } finally { this.setBusy('shadow'); }
    }

    async youtubeSweep(): Promise<void> {
        this.setBusy('youtube', 'Sweeping...');
        this.log('Running YouTube ad container sweep...', 'info');
        try {
            const results = JSON.parse(await this.evalInPage(YT_SWEEP_SCRIPT) as string) as
                Array<{ name: string; selector: string; total: number; visible: number }> & { error?: string };
            if ( results.error ) { this.log(results.error, 'error'); return; }
            const found = results.filter(result => result.total > 0);
            if ( found.length === 0 ) { this.log('No known ad containers detected on this page', 'success'); }
            else {
                this.log(`Found ${found.length} ad container type(s):`, 'info');
                found.forEach(result => this.log(`  ${result.name}: ${result.total} element(s) — ${result.selector}`, result.visible > 0 ? 'error' : 'info'));
            }
            this.log(`${results.filter(result => result.total === 0).length}/${results.length} container types clean`, 'success');
        } catch ( error ) { this.log('Sweep failed: ' + errorText(error), 'error'); }
        finally { this.setBusy('youtube'); }
    }

    async applyFilter(): Promise<void> {
        const filter = this.state.filterText.trim();
        if ( !filter ) { return; }
        this.setBusy('apply', 'Saving...');
        const match = filter.match(/(?:##|#@#)(.+)$/);
        if ( match === null ) {
            this.log('Invalid filter format — expected "domain##selector"', 'error');
            this.setBusy('apply');
            return;
        }
        const selector = match[1];
        const procedural = PROCEDURAL_RE.test(selector);
        if ( procedural === false && isValidCssSelector(selector) === false ) {
            this.log('Invalid CSS selector — not saved. Fix the syntax and try again.', 'error');
            this.setBusy('apply');
            return;
        }
        const collisions = await this.checkFilterCollision(filter);
        if ( collisions !== null ) {
            for ( const collision of collisions ) {
                if ( collision.type === 'duplicate' ) {
                    this.log('Duplicate: this filter already exists in your list', 'error');
                    this.setBusy('apply');
                    return;
                }
                this.log(`Warning: ${collision.type} rule — ${collision.rule}`, 'info');
            }
        }
        if ( procedural ) {
            this.log('Procedural filter detected. Persisting to uBlock...', 'info');
            if ( await this.persistFilter(filter) ) {
                this.addToHistory(filter, selector, this.state.hostname);
                this.log('Procedural filter saved. Reload the page for it to take effect.', 'success');
            }
            this.setBusy('apply');
            return;
        }
        try {
            const count = Number(await this.evalInPage(HIDE_ELEMENT_SCRIPT(selector)));
            if ( this.closed ) { return; }
            if ( count > 0 ) {
                this.log(`Applied filter: hid ${count} element(s)`, 'success');
                if ( await this.persistFilter(filter) ) { this.addToHistory(filter, selector, this.state.hostname); }
            } else if ( count === 0 ) { this.log('No elements matched the selector', 'error'); }
            else { this.log('Invalid selector', 'error'); }
        } catch ( error ) { this.log('Failed to apply: ' + errorText(error), 'error'); }
        finally { this.setBusy('apply'); }
    }

    copyFilter(): void {
        const filter = this.state.filterText.trim();
        if ( !filter ) { return; }
        navigator.clipboard.writeText(filter).then(() => {
            this.log('Filter copied to clipboard', 'success');
            this.patch({ copied: true });
            if ( this.copiedTimer !== 0 ) { self.clearTimeout(this.copiedTimer); }
            this.copiedTimer = self.setTimeout(() => {
                this.copiedTimer = 0;
                this.patch({ copied: false });
            }, COPIED_DELAY);
        }).catch(() => {
            this.log('Could not copy -- select the filter text and copy manually', 'info');
            this.selectOutput?.();
        });
    }

    copyText(text: string): void {
        void navigator.clipboard.writeText(text).then(() => {
            this.log('Copied: ' + text, 'success');
        });
    }

    async testFilter(): Promise<void> {
        const filter = this.state.filterText.trim();
        if ( !filter ) { return; }
        this.setBusy('preview', 'Previewing...');
        const match = filter.match(/(?:##|#@#)(.+)$/);
        if ( match === null ) {
            this.log('Invalid filter format', 'error');
            this.setBusy('preview');
            return;
        }
        const selector = match[1];
        if ( PROCEDURAL_RE.test(selector) ) {
            if ( /:remove\(\)/.test(selector) ) {
                this.log(':remove() cannot be previewed (irreversible). Apply to test.', 'info');
                this.setBusy('preview');
                return;
            }
            try {
                const result = JSON.parse(await this.evalInPage(PROCEDURAL_HIGHLIGHT_SCRIPT(selector)) as string || '{}') as { count?: number; note?: string };
                const count = result.count ?? 0;
                if ( count > 0 ) { this.setHighlighting(true); this.log(`Preview: ${count} element(s) match procedural filter`, 'info'); }
                else { this.log(result.note || 'No elements match this procedural filter on the current page', count < 0 ? 'error' : 'info'); }
            } catch ( error ) { this.log('Procedural preview failed: ' + errorText(error), 'error'); }
            finally { this.setBusy('preview'); }
            return;
        }
        try {
            await this.evalInPage(HIGHLIGHT_SCRIPT(selector));
            this.setHighlighting(true);
            this.log(`Preview: highlighting elements matching "${selector}"`, 'info');
        } catch ( error ) { this.log('Preview failed: ' + String(error), 'error'); }
        finally { this.setBusy('preview'); }
    }

    async removePreview(): Promise<void> {
        try {
            await this.evalInPage(REMOVE_HIGHLIGHT_SCRIPT);
            this.setHighlighting(false);
            this.log('Preview removed', 'info');
        } catch ( error ) { this.log('Failed to remove preview: ' + String(error), 'error'); }
    }

    async testApply(): Promise<void> {
        const filter = this.state.filterText.trim();
        const match = filter.match(/(?:##|#@#)(.+)$/);
        if ( match === null ) { this.log('Invalid filter format', 'error'); return; }
        if ( PROCEDURAL_RE.test(match[1]) ) { this.log('Temporary apply only works with standard CSS selectors.', 'info'); return; }
        this.setBusy('test', 'Testing...');
        try {
            const count = Number(await this.evalInPage(HIDE_ELEMENT_SCRIPT(match[1])));
            if ( this.closed ) { return; }
            if ( count > 0 ) {
                this.log(`Test: hid ${count} element(s) — reverting in 5 seconds`, 'info');
                self.setTimeout(async () => {
                    if ( this.closed ) { return; }
                    await this.unhideOnPage(match[1]);
                    this.log('Test reverted', 'info');
                }, TEST_REVERT_DELAY);
            } else { this.log('No elements matched for test', 'info'); }
        } catch ( error ) { this.log('Test failed: ' + errorText(error), 'error'); }
        finally { this.setBusy('test'); }
    }

    /**************************************************************************/
    // frames.js

    async scanFrames(): Promise<FrameEntry[]> {
        try {
            const frames = JSON.parse(await this.evalInPage(FRAME_SCAN_SCRIPT, '') as string) as FrameEntry[];
            this.patch({ frames });
            return frames;
        } catch ( error ) {
            this.log('Frame scan failed: ' + errorText(error), 'error');
            return [];
        }
    }

    async scanIframes(): Promise<void> {
        this.setBusy('iframes', 'Scanning...');
        this.log('Scanning for iframes...', 'info');
        try {
            const frames = JSON.parse(await this.evalInPage(FRAME_SCAN_SCRIPT, '') as string) as FrameEntry[];
            if ( frames.length === 0 ) { this.log('No iframes found on this page', 'info'); }
            else {
                this.log(`Found ${frames.length} iframe(s):`, 'success');
                frames.forEach(frame => this.log(`  ${frame.src} [${frame.dims}]`, 'info'));
            }
            await this.scanFrames();
            this.setStatus('Scan complete', 'active');
        } catch ( error ) { this.log('iframe scan failed: ' + errorText(error), 'error'); }
        finally { this.setBusy('iframes'); }
    }

    async refreshFrames(): Promise<void> {
        this.log('Refreshing iframe list...', 'info');
        const frames = await this.scanFrames();
        this.log('Found ' + frames.length + ' iframe(s)', frames.length ? 'success' : 'info');
    }

    setFrameUrl(value: string): void {
        const frame = this.state.frames.find(entry => entry.src === value);
        const label = value === '' || frame === undefined ? t('epFrameTopDoc') : frameLabel(frame);
        this.patch({ frameUrl: value });
        this.log(value ? 'Targeting iframe: ' + label : 'Targeting top frame', 'info');
        this.setStatus(value ? 'Frame: ' + label.substring(0, 30) : t('epStatusReady'), 'active');
        this.setSelectionSummary(value ? 'Inspecting inside ' + label : t('epOverviewTargetHint'));
    }

    private detectYouTube(): void {
        api.devtools.inspectedWindow.eval('location.hostname', undefined, (hostname, error) => {
            if ( this.closed || error ) { return; }
            this.patch({ isYouTube: typeof hostname === 'string' && hostname.includes('youtube.com') });
        });
    }

    /**************************************************************************/
    // history.js

    private async saveHistory(): Promise<void> {
        try {
            await api.storage.local.set({ [HISTORY_KEY]: this.state.history });
        } catch ( error ) {
            this.log('Failed to save history: ' + String(error), 'error');
        }
    }

    private async loadHistory(): Promise<void> {
        let history: HistoryEntry[] = [];
        try {
            const data = await api.storage.local.get(HISTORY_KEY);
            history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] as HistoryEntry[] : [];
        } catch { history = []; }
        this.patch({ history });
    }

    private addToHistory(filter: string, selector: string, hostname: string): void {
        const existing = this.state.history.find(entry => entry.filter === filter);
        const now = Date.now();
        let history: HistoryEntry[];
        if ( existing !== undefined ) {
            const updated: HistoryEntry = { ...existing, active: true, hostname, selector, timestamp: now };
            history = [ updated, ...this.state.history.filter(entry => entry !== existing) ];
        } else {
            history = [ { active: true, filter, hostname, selector, timestamp: now }, ...this.state.history ];
        }
        history.length = Math.min(history.length, 50);
        this.patch({ history });
        void this.saveHistory();
    }

    clearHistory(): void {
        this.patch({ history: [], historySearch: '' });
        void this.saveHistory();
        this.log('Filter history cleared', 'info');
    }

    setHistorySearch(value: string): void { this.patch({ historySearch: value }); }

    private unhideOnPage(selector: string): Promise<number> {
        return this.evalInPage(unhideScript(selector)).then(Number).catch(() => -1);
    }

    private sendMessageAsync(message: unknown): Promise<{ error?: string; ok: boolean; response?: unknown }> {
        return new Promise(resolve => {
            try {
                api.runtime.sendMessage(message, response => {
                    const error = api.runtime.lastError;
                    resolve(error
                        ? { error: error.message || String(error), ok: false }
                        : { ok: true, response });
                });
            } catch ( error ) {
                resolve({ error: errorText(error), ok: false });
            }
        });
    }

    async undoFilter(index: number): Promise<void> {
        const entry = this.state.history[index];
        if ( entry === undefined ) { return; }
        const result = await this.sendMessageAsync({
            docURL: this.state.pageUrl || undefined,
            filters: entry.filter,
            what: 'removeUserFilter',
        });
        if ( this.closed ) { return; }
        if ( result.ok ) {
            this.log('Filter removed from user filter list: ' + entry.filter, 'success');
        } else {
            const count = await this.unhideOnPage(entry.selector);
            if ( this.closed ) { return; }
            this.log(`Un-hid ${count === -1 ? 0 : count} element(s) on page (filter not removed from list — remove manually)`, 'info');
        }
        this.setHistoryEntry(index, { active: false });
        void this.saveHistory();
    }

    async reapplyFilter(index: number): Promise<void> {
        const entry = this.state.history[index];
        if ( entry === undefined ) { return; }
        let persisted = false;
        try {
            const count = Number(await this.evalInPage(HIDE_ELEMENT_SCRIPT(entry.selector)));
            if ( this.closed ) { return; }
            if ( count > 0 ) { this.log('Re-applied: hid ' + count + ' element(s)', 'success'); }
            persisted = await this.persistFilter(entry.filter);
        } catch ( error ) {
            this.log('Re-apply failed: ' + String(error), 'error');
        }
        if ( this.closed ) { return; }
        this.setHistoryEntry(index, { active: persisted });
        void this.saveHistory();
    }

    private setHistoryEntry(index: number, patch: Partial<HistoryEntry>): void {
        const history = this.state.history.map((entry, i) => i === index ? { ...entry, ...patch } : entry);
        this.patch({ history });
    }

    private async checkFilterCollision(newFilter: string): Promise<Collision[] | null> {
        const content = await new Promise<string | null>(resolve => {
            try {
                api.runtime.sendMessage({ what: 'getUserRules' }, response => {
                    if ( api.runtime.lastError || !response ) { resolve(null); return; }
                    resolve(String((response as { content?: string }).content || ''));
                });
            } catch { resolve(null); }
        });
        if ( content === null ) { return null; }
        return collisionsOf(content, newFilter);
    }

    private persistFilter(filter: string): Promise<boolean> {
        return new Promise(resolve => {
            try {
                api.runtime.sendMessage({
                    autoComment: true,
                    docURL: this.state.pageUrl || undefined,
                    filters: filter,
                    what: 'createUserFilter',
                }, () => {
                    if ( this.closed ) { resolve(false); return; }
                    if ( api.runtime.lastError ) {
                        this.log('Could not persist to filter list (copy and add manually)', 'info');
                        resolve(false);
                    } else {
                        this.log('Filter persisted to user filter list', 'success');
                        resolve(true);
                    }
                });
            } catch { resolve(false); }
        });
    }

    /**************************************************************************/
    // element-probe-panel.js

    start(): void {
        if ( this.started ) { return; }
        this.started = true;
        const onClose = () => { this.closed = true; };
        self.addEventListener('pagehide', onClose, { once: true });
        self.addEventListener('unload', onClose, { once: true });
        api.storage.local.get('probeClassPatterns', result => {
            this.classPatterns = Array.isArray(result.probeClassPatterns)
                ? result.probeClassPatterns as string[]
                : DEFAULT_CLASS_PATTERNS;
        });
        if ( api.devtools.panels?.elements ) {
            api.devtools.panels.elements.onSelectionChanged.addListener(() => {
                if ( this.closed ) { return; }
                if ( this.selectionTimer !== 0 ) { self.clearTimeout(this.selectionTimer); }
                this.selectionTimer = self.setTimeout(() => {
                    this.selectionTimer = 0;
                    if ( this.closed ) { return; }
                    this.log('Element selection changed', 'info');
                    void this.inspectSelected();
                }, SELECTION_DELAY);
            });
        }
        if ( api.devtools.inspectedWindow.onNavigated ) {
            api.devtools.inspectedWindow.onNavigated.addListener(() => {
                if ( this.closed ) { return; }
                this.resetInspectionState();
                this.setStatus(t('epStatusReady'), 'idle');
                this.setSelectionSummary(t('epNoElementSelected'));
                this.syncFilterActions();
                this.log('Page navigated — state reset', 'info');
                void this.scanFrames();
                this.detectYouTube();
            });
        }
        void this.loadHistory();
        void this.scanFrames();
        this.detectYouTube();
        this.log(`Element Probe v${PANEL_VERSION} initialized`, 'info');
        this.setStatus(t('epStatusReady'));
        this.setSelectionSummary(t('epNoElementSelected'));
        this.syncFilterActions();
    }
}

/******************************************************************************/

let singleton: ProbeStore | undefined;

export function useProbe(): [ ProbeState, ProbeStore ] {
    if ( singleton === undefined ) { singleton = new ProbeStore(); }
    const store = singleton;
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
    useEffect(() => { store.start(); }, [ store ]);
    return [ state, store ];
}
