import { FilledButton, FilledTonalButton, OutlinedButton, TextButton } from 'material-expressive-react/button';
import { useRef } from 'react';
import { Icon } from './Icon';

type Variant = 'outlined' | 'tonal' | 'filled' | 'text';

const buttons = {
    outlined: OutlinedButton,
    tonal: FilledTonalButton,
    filled: FilledButton,
    text: TextButton,
};

interface FilePickerProps {
    /** Button text, and the accessible name of the control. */
    label: string;
    /** Material Symbols SVG for the button's icon slot. */
    icon: string;
    /** Accept list handed to the file dialog, e.g. "text/plain,.txt". */
    accept: string;
    onFile: (file: File) => void;
    variant?: Variant;
    disabled?: boolean;
    /** Tooltip text; defaults to the label. */
    tip?: string;
    className?: string;
    /** id for the button, for pages that key styles or tests on it. */
    id?: string;
    /** id and name for the input itself. */
    inputId?: string;
    inputName?: string;
}

// Choosing a file is the one thing Material has no component for: only a
// native <input type="file"> can open the OS file dialog, and only from a
// user gesture. So the native input is the engine and never the interface —
// it is hidden here, inside one shared component, and the thing the user
// sees and operates is an ordinary Material button.
//
// The input sits next to its own button rather than at the page root, so a
// page just places this control in a toolbar and has no ref, no stray node
// and no duplicated change handler.
export function FilePicker({
    label, icon, accept, onFile,
    variant = 'outlined', disabled, tip, className, id, inputId, inputName,
}: FilePickerProps) {
    const input = useRef<HTMLInputElement>(null);
    const Button = buttons[variant];
    return (
        <>
            <Button
                id={id}
                className={className}
                disabled={disabled}
                data-tip={tip ?? label}
                onClick={() => {
                    const el = input.current;
                    if ( el === null ) { return; }
                    // Clearing first means picking the same file twice in a
                    // row still fires change.
                    el.value = '';
                    el.click();
                }}
            >
                <Icon slot="icon" svg={icon} />
                {label}
            </Button>
            <input
                ref={input}
                className="ubv-file-input"
                type="file"
                id={inputId}
                name={inputName}
                accept={accept}
                tabIndex={-1}
                aria-hidden="true"
                hidden
                onChange={ev => {
                    const file = ev.target.files?.[0];
                    if ( file !== undefined ) { onFile(file); }
                }}
            />
        </>
    );
}
