/**
 * @fileoverview Custom checkbox component.
 * 
 * Wraps Headless UI Switch for accessible checkbox functionality.
 * Styled as a traditional checkbox with check icon.
 * Supports optional label.
 * 
 * @module components/Checkbox
 */

import { Switch } from '@headlessui/react';
import { Check } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Props for Checkbox component */
interface CheckboxProps {
    /** Whether the checkbox is checked */
    checked: boolean;
    /** Callback when checked state changes */
    onChange: (checked: boolean) => void;
    /** Optional label text */
    label?: string;
    /** Additional CSS classes */
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Accessible checkbox component with custom styling.
 * 
 * Features:
 * - Accessible via Headless UI Switch
 * - Check icon when selected
 * - Primary color accent when checked
 * - Optional clickable label
 * - Dark mode support
 * 
 * @param checked - Whether checkbox is checked
 * @param onChange - Change callback
 * @param label - Optional label text
 * @param className - Additional CSS classes
 */
export function Checkbox({ checked, onChange, label, className = '' }: CheckboxProps) {
    return (
        <Switch.Group>
            <div className={`flex items-center gap-2 ${className}`}>
                <Switch
                    checked={checked}
                    onChange={onChange}
                    className={`relative inline-flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${checked
                            ? 'bg-primary border-primary'
                            : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                        }`}
                >
                    {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                </Switch>
                {label && (
                    <Switch.Label className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                        {label}
                    </Switch.Label>
                )}
            </div>
        </Switch.Group>
    );
}
