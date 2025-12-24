/**
 * @fileoverview Custom select/dropdown component.
 * 
 * Wraps Headless UI Listbox with custom styling.
 * Provides a styled dropdown with icon support and animations.
 * Used for RAGFlow source selection in the layout header.
 * 
 * @module components/Select
 */

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Option item for the select dropdown */
interface SelectOption {
    /** Unique identifier for the option */
    id: string;
    /** Display name for the option */
    name: string;
}

/** Props for Select component */
interface SelectProps {
    /** Currently selected option ID */
    value: string;
    /** Callback when selection changes */
    onChange: (value: string) => void;
    /** Array of available options */
    options: SelectOption[];
    /** Optional icon to display before the selected value */
    icon?: React.ReactNode;
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Custom styled select/dropdown component.
 * 
 * Features:
 * - Gradient background styling
 * - Optional leading icon
 * - Animated chevron indicator
 * - Smooth dropdown transition
 * - Checkmark on selected option
 * - Dark mode support
 * 
 * @param value - Currently selected option ID
 * @param onChange - Selection change callback
 * @param options - Available options
 * @param icon - Optional icon element
 * @param className - Additional CSS classes
 */
export function Select({ value, onChange, options, icon, disabled = false, className = '' }: SelectProps) {
    // Find the currently selected option for display
    const selectedOption = options.find(opt => opt.id === value);

    return (
        <Listbox value={value} onChange={onChange} disabled={disabled}>
            {({ open }) => (
                <div className={`relative inline-block min-w-[200px] ${className}`}>
                    <Listbox.Button className={`relative flex items-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-slate-800 dark:to-slate-800 dark:bg-slate-800 rounded-lg border border-primary/20 dark:border-slate-600 shadow-sm hover:shadow-md transition-shadow text-left ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {!!icon && <span className="text-primary dark:text-blue-400 flex-shrink-0">{icon}</span>}
                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            {selectedOption?.name || 'Select...'}
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-primary dark:text-blue-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''
                                }`}
                        />
                    </Listbox.Button>

                    <Transition
                        as={Fragment as any}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <Listbox.Options className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                            {options.map((option) => (
                                <Listbox.Option
                                    key={option.id}
                                    value={option.id}
                                    className={({ active, selected }) =>
                                        `relative cursor-pointer select-none py-2.5 pl-10 pr-4 ${active
                                            ? 'bg-gradient-to-r from-primary/10 to-primary/5 dark:bg-slate-600 text-primary dark:text-white'
                                            : 'text-slate-700 dark:text-slate-200'
                                        } ${selected ? 'font-medium' : 'font-normal'}`
                                    }
                                >
                                    {({ selected }) => (
                                        <>
                                            <span className="block truncate">{option.name}</span>
                                            {selected && (
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary dark:text-blue-400">
                                                    <Check size={16} />
                                                </span>
                                            )}
                                        </>
                                    )}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </Transition>
                </div>
            )}
        </Listbox>
    );
}
