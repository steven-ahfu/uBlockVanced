/*******************************************************************************

    uBlockVanced - page-context scripts used by the Element Probe panel.

    These are code strings evaluated in the inspected page, so the only way to
    test them is to run them against a stub page. The context's global object
    must BE the stub window: in a page a bare `setTimeout` resolves through the
    global object, and the picker patches `window.setTimeout`. Passing timers
    in as parameters would shadow the patch and hide the very bug these tests
    exist to pin.

*/

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
    HIGHLIGHT_SCRIPT,
    PICK_ELEMENT_SCRIPT,
    PROCEDURAL_HIGHLIGHT_SCRIPT,
} from '../src/js/element-probe/page-scripts.js';
import vm from 'node:vm';

/******************************************************************************/

const stubElement = (rect = { top: 0, left: 0, width: 10, height: 10 }) => ({
    nodeType: 1,
    id: '',
    className: '',
    style: { cssText: '', pointerEvents: 'none', setProperty() {} },
    textContent: '',
    getBoundingClientRect: ( ) => rect,
    remove() {},
    appendChild() {},
});

// A page just real enough for these scripts: element creation, one flat
// querySelectorAll, and records of what was appended and listened to.
const stubPage = ({ matches = [], viewport = { width: 1280, height: 800 } } = {}) => {
    const appended = [];
    const handlers = {};
    const pageTarget = { ...stubElement(), id: 'the-thing-you-clicked', tagName: 'SPAN' };
    const docListeners = [];
    const winListeners = [];
    const realTimers = [];
    const body = stubElement({ top: 0, left: 0, ...viewport });
    const documentElement = {
        ...stubElement({ top: 0, left: 0, ...viewport }),
        appendChild(node) { appended.push(node); },
    };
    const document = {
        documentElement,
        body,
        createElement: ( ) => stubElement(),
        getElementById: id => appended.find(n => n.id === id) || null,
        addEventListener: (type, fn) => { docListeners.push(type); handlers[type] = fn; },
        removeEventListener() {},
        // A real page returns the topmost element that accepts pointer events.
        // The picker's overlay covers the viewport, so if it is still taking
        // them it IS the answer -- which is exactly the bug worth pinning.
        elementFromPoint( ) {
            const overlay = appended.find(n => n.id === '__ubp_picker_overlay__');
            if ( overlay !== undefined && overlay.style.pointerEvents === 'auto' ) {
                return overlay;
            }
            return pageTarget;
        },
        querySelectorAll(selector) {
            if ( selector === '.__ubp_highlight__' ) {
                return appended.filter(n => n.className === '__ubp_highlight__');
            }
            return matches;
        },
    };
    const win = {
        document,
        setTimeout: (fn, ms) => { realTimers.push({ fn, ms }); return realTimers.length; },
        setInterval: ( ) => 0,
        requestAnimationFrame: ( ) => 0,
        addEventListener: type => winListeners.push(type),
        removeEventListener() {},
        getComputedStyle: ( ) => ({ getPropertyValue: ( ) => '' }),
        location: { pathname: '/', search: '' },
        inspect(el) { win.__inspected = el; },
        // The scripts branch on `r instanceof Element` to decide whether an
        // operator returned a new target (:upward) or a verdict (:has-text).
        // Stub nodes are plain objects, so identify them structurally.
        HTMLElement: { [Symbol.hasInstance]: v => v !== null && typeof v === 'object' && v.nodeType === 1 },
        Element: { [Symbol.hasInstance]: v => v !== null && typeof v === 'object' && v.nodeType === 1 },
        JSON,
        RegExp,
        Array,
        Math,
        parseInt,
    };
    win.window = win;
    win.globalThis = win;
    vm.createContext(win);
    const run = script => vm.runInContext('(' + script + ')', win);
    const overlays = ( ) => appended.filter(n => n.className === '__ubp_highlight__');
    return {
        run, win, document, body, documentElement, appended, overlays,
        docListeners, winListeners, realTimers, handlers, pageTarget,
    };
};

/******************************************************************************/

describe('element picker (page context)', ( ) => {
    it('arms its listeners through the unpatched setTimeout', ( ) => {
        const page = stubPage();
        assert.equal(page.run(PICK_ELEMENT_SCRIPT), 'picker_started');

        // The picker freezes window.setTimeout to hold the page still. Its own
        // arming timer must therefore be queued on the captured original, or it
        // freezes itself: no listeners, no way to cancel, and a page whose
        // timers stay hijacked until it is reloaded.
        const arming = page.realTimers.find(t => t.ms === 100);
        assert.ok(arming, 'arming timer never reached the real setTimeout');
        arming.fn();
        assert.deepEqual(page.docListeners, [ 'keydown', 'mousemove', 'click' ]);
    });

    it('hit-tests the page, not its own overlay', ( ) => {
        // The overlay must keep taking pointer events -- that is what stops the
        // click from reaching the page -- so it has to be lifted out of
        // hit-testing for the length of the question instead.
        const page = stubPage();
        page.run(PICK_ELEMENT_SCRIPT);
        page.realTimers.find(t => t.ms === 100).fn();

        const overlay = page.appended.find(n => n.id === '__ubp_picker_overlay__');
        const highlight = page.appended.find(n => n.id === '__ubp_picker_highlight__');
        assert.equal(overlay.style.pointerEvents, 'auto', 'overlay stopped swallowing the click');

        page.handlers.mousemove({ clientX: 40, clientY: 40 });
        assert.equal(highlight.style.display, 'block', 'hover never highlighted anything');
        assert.equal(overlay.style.pointerEvents, 'auto', 'overlay was left inert after hit-testing');

        page.handlers.click({
            clientX: 40, clientY: 40,
            preventDefault( ) {}, stopPropagation( ) {}, stopImmediatePropagation( ) {},
        });
        assert.equal(page.win.__inspected, page.pageTarget, 'inspect() got the wrong element');
    });

    it('binds Escape before arming, so a pick can always be cancelled', ( ) => {
        const page = stubPage();
        page.run(PICK_ELEMENT_SCRIPT);
        assert.deepEqual(page.docListeners, [ 'keydown' ]);
    });

    it('restores the page timer APIs when its watchdog fires', ( ) => {
        const page = stubPage();
        const original = page.win.setTimeout;
        page.run(PICK_ELEMENT_SCRIPT);
        assert.notEqual(page.win.setTimeout, original, 'timers should be frozen while picking');

        const watchdog = page.realTimers.find(t => t.ms === 60000);
        assert.ok(watchdog, 'no watchdog: a failed pick would freeze the page forever');
        watchdog.fn();
        assert.equal(page.win.setTimeout, original);
        assert.equal(page.win.__ubp_picker_active__, false);
    });
});

/******************************************************************************/

describe('highlight overlays (page context)', ( ) => {
    it('paints one overlay per matched element', ( ) => {
        const page = stubPage({ matches: [ stubElement(), stubElement() ] });
        page.run(HIGHLIGHT_SCRIPT('div.ad'));
        assert.equal(page.overlays().length, 2);
    });

    it('never paints the page root', ( ) => {
        // <html> and <body> fill the viewport, so an overlay over either is a
        // sheet of colour across the whole page with nothing clickable behind
        // the panel's own idea of what it highlighted.
        const page = stubPage();
        page.run(HIGHLIGHT_SCRIPT('body'));
        assert.equal(page.overlays().length, 0);
    });

    it('drops stale overlays on the next scroll', ( ) => {
        const page = stubPage({ matches: [ stubElement() ] });
        page.run(HIGHLIGHT_SCRIPT('div.ad'));
        assert.ok(page.winListeners.includes('scroll'));
    });

    it('reports a procedural match that resolves to the page root', ( ) => {
        // :upward(N) deeper than the element's ancestry lands on <body>.
        const page = stubPage({ matches: [ stubElement() ] });
        page.win.document.body.parentElement = null;
        const target = page.win.document.querySelectorAll('div')[0];
        target.textContent = 'Subscribe';
        target.parentElement = page.body;
        const out = JSON.parse(page.run(PROCEDURAL_HIGHLIGHT_SCRIPT('div:has-text(Subscribe):upward(1)')));
        assert.equal(out.count, 1);
        assert.match(out.note, /page root/);
        assert.equal(page.overlays().length, 0);
    });
});
