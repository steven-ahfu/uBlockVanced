// uBlockVanced - the DOM inspector pane.
//
// The tree itself is still driven by the upstream module
// `src/js/logger-ui-inspector.js`: it owns a BroadcastChannel to the inspected
// page, a tabs port, and the incremental render of #domTree. Porting it is a
// separate job, so this component renders the chrome it binds to -- Material
// icon buttons carrying the class names upstream selects on -- and loads it
// once, after `self.logger` exists (see bridge.ts).
//
// #showdom stays the upstream <button> node, hidden, purely as the on/off
// latch the module toggles; the visible control is the Material toggle in the
// top toolbar, which clicks it and mirrors its `active` class back.

import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { Toolbar } from 'material-expressive-react';
import { installLoggerGlobal } from '../bridge';
import { loggerIcons } from '../icons';
import { t } from '../../../shared/i18n';
import { useEffect } from 'react';

const INSPECTOR_SCRIPT = 'js/logger-ui-inspector.js';

let loaded = false;

// Clicks the retained latch; the module's own toggle() does the rest.
export function toggleDomInspector(): void {
    const latch = document.getElementById('showdom');
    if ( latch === null ) { return; }
    latch.click();
}

interface Props {
    tooltips: boolean;
    tabIdOf(): number;
    onActiveChange(active: boolean): void;
}

export function DomInspector({ tooltips, tabIdOf, onActiveChange }: Props) {
    const tip = (key: string) => tooltips ? t(key) : undefined;

    useEffect(() => {
        installLoggerGlobal(tabIdOf);
        if ( loaded === false ) {
            loaded = true;
            void import(new URL(INSPECTOR_SCRIPT, document.baseURI).href);
        }
        const latch = document.getElementById('showdom');
        if ( latch === null ) { return; }
        const sync = () => { onActiveChange(latch.classList.contains('active')); };
        const observer = new MutationObserver(sync);
        observer.observe(latch, { attributeFilter: [ 'class' ] });
        sync();
        return () => { observer.disconnect(); };
    }, [ onActiveChange, tabIdOf ]);

    return (
        <div id="domInspector" className="inspector hCompact">
            <Toolbar
                variant="Docked"
                dockPosition="Top"
                size="Small"
                className="permatoolbar ubv-logger-bar"
                role="toolbar"
                aria-label={t('loggerDomInspectorTip')}
            >
                <div className="ubv-logger-bar-main">
                    <IconButton
                        className="vExpandToggler"
                        variant="standard"
                        data-tip={tip('loggerInspectorExpandTip')}
                        aria-label={t('loggerInspectorExpandTip')}
                    >
                        <Icon svg={loggerIcons.vExpand} />
                    </IconButton>
                    <IconButton
                        className="vCompactToggler"
                        variant="standard"
                        data-tip={tip('loggerInspectorCompactHeightTip')}
                        aria-label={t('loggerInspectorCompactHeightTip')}
                    >
                        <Icon svg={loggerIcons.rows} />
                    </IconButton>
                    <IconButton
                        className="hCompactToggler"
                        variant="standard"
                        data-tip={tip('loggerInspectorCompactWidthTip')}
                        aria-label={t('loggerInspectorCompactWidthTip')}
                    >
                        <Icon svg={loggerIcons.hCompact} />
                    </IconButton>
                    <IconButton
                        className="revert disabled"
                        variant="standard"
                        data-tip={tip('loggerInspectorRevertTip')}
                        aria-label={t('loggerInspectorRevertTip')}
                    >
                        <Icon svg={loggerIcons.revert} />
                    </IconButton>
                    <IconButton
                        className="commit disabled"
                        variant="standard"
                        data-tip={tip('loggerInspectorCommitTip')}
                        aria-label={t('loggerInspectorCommitTip')}
                    >
                        <Icon svg={loggerIcons.commit} />
                    </IconButton>
                </div>
            </Toolbar>
            <div className="vscrollable">
                <ul id="domTree" />
            </div>
        </div>
    );
}
