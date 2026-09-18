import { Textfield } from 'material-expressive-react/textfield';
import { Icon } from '../../../shared/Icon';
import { IconButton } from '../../../shared/IconButton';
import { icons } from '../../../shared/icons';
import { t } from '../../../shared/i18n';
import { Card } from '../../../shared/Card';
import type { FilterListsActions, FilterListsState } from '../useFilterLists';

interface Props { state: FilterListsState; actions: FilterListsActions }

// External list URLs to import, one per line; applied with the Apply button.
export function ImportCard({ state, actions }: Props) {
    return (
        <Card className="ubv-import" aria-label={t('3pImport')}>
            <header className="ubv-group-header">
                <h2 className="ubv-group-title">{t('3pImport')}</h2>
                <IconButton variant="standard"
                    href="https://github.com/gorhill/uBlock/wiki/Filter-lists-from-around-the-web" target="_blank"
                    data-tip={t('3pReadInstructions')} aria-label={t('3pReadInstructions')}>
                    <Icon svg={icons.info} />
                </IconButton>
            </header>
            <Textfield
                className="ubv-import-field"
                variant="outlined"
                type="textarea"
                rows={4}
                name="externalLists"
                placeholder={t('3pExternalListsHint')}
                aria-label={t('3pImport')}
                value={state.importText}
                textDirection="ltr"
                spellCheck={false}
                onInput={ev => { actions.setImportText((ev.target as HTMLTextAreaElement).value); }}
            />
        </Card>
    );
}
