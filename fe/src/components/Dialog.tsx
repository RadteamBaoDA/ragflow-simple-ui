/**
 * @fileoverview Reusable modal dialog component.
 * 
 * Wraps Headless UI Dialog with consistent styling and animations.
 * Provides a standard layout with header, body, and optional footer.
 * Supports dark mode and multiple width presets.
 * 
 * @module components/Dialog
 */

import { Fragment, ReactNode } from 'react';
import { Dialog as HeadlessDialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Props for Dialog component */
interface DialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback when dialog should close */
    onClose: () => void;
    /** Dialog title displayed in header */
    title: string;
    /** Dialog body content */
    children: ReactNode;
    /** Optional footer content (typically action buttons) */
    footer?: ReactNode;
    /** Maximum width preset */
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'none';
    /** Custom class name for the dialog panel */
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

// Map width preset to Tailwind class
const maxWidthClasses = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-xl',
    '2xl': 'w-full max-w-2xl',
    '3xl': 'w-full max-w-3xl',
    '4xl': 'w-full max-w-4xl',
    '5xl': 'w-full max-w-5xl',
    '6xl': 'w-full max-w-6xl',
    '7xl': 'w-full max-w-7xl',
    full: 'w-full max-w-full',
    none: 'max-w-none', // No w-full here allowing custom width
};

/**
 * Reusable modal dialog with consistent styling.
 * 
 * Features:
 * - Backdrop overlay with animation
 * - Centered dialog with scale animation
 * - Header with title and close button
 * - Body content area
 * - Optional footer for action buttons
 * - Dark mode support
 * 
 * @param {DialogProps} props - Component properties
 * @returns {JSX.Element} The rendered Dialog
 */
export function Dialog({
    open,
    onClose,
    title,
    children,
    footer,
    maxWidth = 'md',
    className = ''
}: DialogProps) {

    return (
        <Transition appear show={open} as={Fragment}>
            <HeadlessDialog className="relative z-50" onClose={onClose}>
                {/* Backdrop */}
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/70" />
                </TransitionChild>

                {/* Dialog Container */}
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel
                                className={`${maxWidthClasses[maxWidth]} ${className} transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl transition-all flex flex-col`}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6 shrink-0">
                                    <DialogTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                                        {title}
                                    </DialogTitle>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="text-slate-600 dark:text-slate-400 flex-1 min-h-0">
                                    {children}
                                </div>

                                {/* Footer */}
                                {!!footer && (
                                    <div className="mt-6 flex justify-end gap-2">
                                        {footer}
                                    </div>
                                )}
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    );
}
