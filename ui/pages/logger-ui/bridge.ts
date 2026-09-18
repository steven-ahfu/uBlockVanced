// uBlockVanced - the `self.logger` surface the retained DOM inspector
// (src/js/logger-ui-inspector.js) reads at module scope, plus the upstream
// modal overlay it reuses for its "commit cosmetic filters" dialog.
//
// Everything else on the page is React; this file exists only so that one
// upstream module keeps working unchanged. See components/DomInspector.tsx.

export interface ModalDialogApi {
    create(selector: string, destroyListener?: (dialog: Element) => void): Element;
    show(): void;
    destroy(): void;
}

export interface LoggerGlobal {
    ownerId: number | undefined;
    tabIdFromPageSelector(): number;
    removeAllChildren(node: Node): void;
    modalDialog: ModalDialogApi;
}

function removeAllChildren(node: Node): void {
    while ( node.firstChild ) { node.removeChild(node.firstChild); }
}

// Verbatim behaviour of upstream's modalDialog, bound to the #modalOverlay /
// #templates nodes main.tsx keeps from the upstream markup.
function createModalDialog(): ModalDialogApi {
    let onDestroyed: ((dialog: Element) => void) | undefined;
    let lastFocusedElement: Element | null = null;

    const overlay = (): HTMLElement | null => document.getElementById('modalOverlay');
    const container = (): HTMLElement | null => document.getElementById('modalOverlayContainer');
    const closeButton = (): HTMLElement | null => {
        const root = overlay();
        return root === null ? null : root.querySelector<HTMLElement>('.closeButton');
    };

    const destroy = (): void => {
        const root = overlay();
        const host = container();
        if ( root === null || host === null ) { return; }
        root.classList.remove('on');
        root.setAttribute('aria-hidden', 'true');
        const dialog = host.firstElementChild;
        removeAllChildren(host);
        if ( typeof onDestroyed === 'function' && dialog !== null ) {
            onDestroyed(dialog);
        }
        onDestroyed = undefined;
        if ( lastFocusedElement instanceof HTMLElement ) { lastFocusedElement.focus(); }
        lastFocusedElement = null;
    };

    const create = (selector: string, destroyListener?: (dialog: Element) => void): Element => {
        const host = container();
        const template = document.querySelector(selector);
        if ( host === null || template === null ) {
            throw new Error(`logger: missing dialog template ${selector}`);
        }
        const dialog = template.cloneNode(true) as Element;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        removeAllChildren(host);
        host.appendChild(dialog);
        onDestroyed = destroyListener;
        return dialog;
    };

    const show = (): void => {
        const root = overlay();
        if ( root === null ) { return; }
        lastFocusedElement = document.activeElement;
        root.setAttribute('aria-hidden', 'false');
        root.classList.add('on');
        closeButton()?.focus();
    };

    return { create, show, destroy };
}

let installed: LoggerGlobal | undefined;

// Installs (once) the global the inspector reads. `tabIdOf` is re-read on
// every call so the inspector always sees the current page selector.
export function installLoggerGlobal(tabIdOf: () => number): LoggerGlobal {
    if ( installed !== undefined ) { return installed; }
    const modalDialog = createModalDialog();
    const api: LoggerGlobal = {
        ownerId: Date.now(),
        tabIdFromPageSelector: () => tabIdOf(),
        removeAllChildren,
        modalDialog,
    };
    installed = api;
    (self as unknown as { logger: LoggerGlobal }).logger = api;

    const root = document.getElementById('modalOverlay');
    if ( root !== null ) {
        const close = (ev: Event) => {
            const button = root.querySelector('.closeButton');
            if ( ev.target === root || ev.target === button ) { modalDialog.destroy(); }
        };
        root.addEventListener('click', close);
        root.addEventListener('keydown', ev => {
            if ( (ev as KeyboardEvent).key === 'Escape' ) { modalDialog.destroy(); }
        });
        root.setAttribute('aria-hidden', 'true');
    }
    return api;
}

export function loggerGlobal(): LoggerGlobal | undefined {
    return installed;
}
