import type { PopupState } from '../usePopup';

interface Props { state: PopupState }

// The current site, shown above the power control: the registrable domain
// in emphasis, any subdomain prefix as a small label. Mirrors the upstream
// #hostname block (prefix span first, domain span second).
export function SiteName({ state }: Props) {
    const data = state.data;
    if ( data === null || data.pageHostname === '' ) { return null; }
    const hostname = data.pageHostname;
    const domain = data.pageDomain || hostname;
    const prefix = hostname.endsWith(domain) && hostname.length > domain.length
        ? hostname.slice(0, hostname.length - domain.length - 1)
        : '';
    return (
        <div id="hostname" className="ubv-hostname" data-tip={hostname}>
            <span className="ubv-hostname-prefix">{prefix}</span>
            <span className="ubv-hostname-domain">{domain}</span>
        </div>
    );
}
