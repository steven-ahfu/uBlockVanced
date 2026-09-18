import { ConnectedButton, ConnectedButtonGroup, Snackbar, SnackbarDuration } from 'material-expressive-react';
import { TextButton } from 'material-expressive-react/button';
import { MenuSurface } from 'material-expressive-react/menu';
import { LinearProgress } from 'material-expressive-react/progress';
import { Textfield } from 'material-expressive-react/textfield';
import { useEffect, useRef, useState } from 'react';
import { Card } from './Card';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { icons } from './icons';
import { t } from './i18n';
import { send } from './vapi';
import './cloud-widget.css';

interface CloudOptions { enabled?: boolean; deviceName?: string; defaultDeviceName?: string }
interface CloudEntry { data: unknown; source: string; tstamp: number }
interface CloudUsage { max: number; total: number }

export interface CloudBridge {
    data?: unknown;
    onPull: ((data: unknown, append: boolean) => void) | null;
    onPush: (() => unknown) | null;
    options: CloudOptions;
}

type CloudGlobal = typeof globalThis & { cloud?: CloudBridge };

export function CloudWidget({ datakey }: { datakey: string }) {
    const bridge = useRef<CloudBridge>({ onPull: null, onPush: null, options: {} });
    const [ options, setOptions ] = useState<CloudOptions | null>(null);
    const [ entry, setEntry ] = useState<CloudEntry | null>(null);
    const [ usage, setUsage ] = useState<CloudUsage | null>(null);
    const [ error, setError ] = useState('');
    const [ deviceName, setDeviceName ] = useState('');
    const [ showOptions, setShowOptions ] = useState(false);
    const [ busy, setBusy ] = useState(false);
    const optionsAnchor = useRef<HTMLDivElement>(null);
    const globals = self as CloudGlobal;

    // Page hooks already publish their editor callbacks through this bridge.
    // Keep that stable contract while replacing the old DOM widget.
    globals.cloud = bridge.current;

    const refresh = async () => {
        try {
            const result = await send<CloudEntry | string | null>('cloudWidget', { what: 'cloudPull', datakey });
            if ( typeof result === 'string' ) { setError(result); setEntry(null); return; }
            setEntry(result instanceof Object ? result as CloudEntry : null);
            const nextUsage = await send<CloudUsage | null>('cloudWidget', { what: 'cloudUsed', datakey });
            setUsage(nextUsage instanceof Object ? nextUsage as CloudUsage : null);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
    };

    useEffect(() => {
        void send<CloudOptions>('cloudWidget', { what: 'cloudGetOptions' }).then(result => {
            bridge.current.options = result ?? {};
            setOptions(result ?? {});
            setDeviceName(result?.deviceName ?? '');
        });
        return () => { if ( globals.cloud === bridge.current ) { delete globals.cloud; } };
    }, []);

    useEffect(() => { if ( options?.enabled === true ) { void refresh(); } }, [ options?.enabled ]);

    // The options popover closes on Escape or on a click outside it, the
    // way a Material menu does.
    useEffect(() => {
        if ( showOptions === false ) { return; }
        const onKey = (ev: KeyboardEvent) => { if ( ev.key === 'Escape' ) { setShowOptions(false); } };
        const onDown = (ev: Event) => {
            const anchor = optionsAnchor.current;
            if ( anchor === null ) { return; }
            if ( ev.target instanceof Node && anchor.contains(ev.target) ) { return; }
            setShowOptions(false);
        };
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onDown, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('mousedown', onDown, true);
        };
    }, [ showOptions ]);

    if ( options?.enabled !== true ) { return null; }

    const push = async () => {
        if ( bridge.current.onPush === null ) { return; }
        setBusy(true);
        try {
            const result = await send<string | null>('cloudWidget', { what: 'cloudPush', datakey, data: bridge.current.onPush() });
            if ( typeof result === 'string' ) { setError(result); return; }
            setError('');
            await refresh();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setBusy(false);
        }
    };
    const saveOptions = async () => {
        const result = await send<CloudOptions>('cloudWidget', { what: 'cloudSetOptions', options: { deviceName } });
        bridge.current.options = result;
        setOptions(result);
        setShowOptions(false);
    };
    const onAction = (value: string) => {
        switch ( value ) {
        case 'push':
            void push();
            break;
        case 'pull':
            bridge.current.onPull?.(entry?.data, false);
            setError('');
            break;
        case 'merge':
            bridge.current.onPull?.(entry?.data, true);
            break;
        default:
            break;
        }
    };
    const pushDisabled = busy || bridge.current.onPush === null;
    const pullDisabled = entry === null || bridge.current.onPull === null;
    const timestamp = entry === null ? t('cloudNoData') : new Date(entry.tstamp).toLocaleString();

    return (
        <Card className="ubv-cloud-widget" aria-label={t('cloudSyncSettings')}>
            <div className="ubv-card-header">
                <div><h2 className="ubv-card-title">{t('cloudSyncSettings')}</h2><p className="ubv-muted">{entry?.source ?? timestamp}</p></div>
                <div ref={optionsAnchor} className="ubv-cloud-menu">
                    <IconButton variant="standard" aria-haspopup="dialog"
                        aria-expanded={showOptions ? 'true' : 'false'}
                        data-tip={t('cloudSyncSettings')} aria-label={t('cloudSyncSettings')}
                        onClick={() => { setShowOptions(value => value === false); }}><Icon svg={icons.dashboard} /></IconButton>
                    {showOptions ? (
                        <MenuSurface className="ubv-cloud-options" role="dialog" scroll={false}
                            aria-label={t('cloudSyncSettings')}>
                            <Textfield className="ubv-field" variant="outlined" label={t('cloudDeviceNamePrompt')} value={deviceName}
                                placeholder={options.defaultDeviceName} onInput={ev => { setDeviceName((ev.target as HTMLInputElement).value); }} />
                            <TextButton onClick={() => { void saveOptions(); }}>{t('genericSubmit')}</TextButton>
                        </MenuSurface>
                    ) : null}
                </div>
            </div>
            {/* One connected group for the three cloud actions: each keeps its
                own icon, label and disabled state; nothing is ever selected. */}
            <ConnectedButtonGroup className="ubv-cloud-actions" variant="connected" type="square"
                size="small" style="tonal" value="" onClick={onAction}>
                <ConnectedButton value="push" disabled={pushDisabled}
                    icon={<Icon svg={icons.upload} />} label={t('cloudPush')} />
                <ConnectedButton value="pull" disabled={pullDisabled}
                    icon={<Icon svg={icons.download} />} label={t('cloudPull')} />
                <ConnectedButton value="merge" disabled={pullDisabled}
                    icon={<Icon svg={icons.add} />} label={t('cloudPullAndMerge')} />
            </ConnectedButtonGroup>
            {usage !== null && usage.max > 0 ? <LinearProgress className="ubv-cloud-capacity" value={usage.total / usage.max} /> : null}
            <Snackbar className="ubv-cloud-error" open={error !== ''} supportingText={error} multiLine closeButton
                duration={SnackbarDuration.INDEFINITE} onDismiss={() => { setError(''); }} />
        </Card>
    );
}
