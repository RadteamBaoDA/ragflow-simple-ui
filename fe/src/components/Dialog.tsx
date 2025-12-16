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
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
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
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

// ============================================================================
// Component
// ============================================================================

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
 * @param open - Whether dialog is visible
 * @param onClose - Close callback
 * @param title - Header title
 * @param children - Body content
 * @param footer - Optional footer content
 * @param maxWidth - Width preset (default: 'md')
 */
export function Dialog({
    open,
    onClose,
    title,
    children,
    footer,
    maxWidth = 'md'
}: DialogProps) {
    // Map width preset to Tailwind class
    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    };

    return (
        <Transition appear show={open} as={Fragment}>
            <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
                {/* Backdrop */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/70" />
                </Transition.Child>

                {/* Dialog Container */}
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <HeadlessDialog.Panel
                                className={`w-full ${maxWidthClasses[maxWidth]} transform overflow-hidden rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl transition-all`}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <HeadlessDialog.Title className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                                        {title}
                                    </HeadlessDialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="text-slate-600 dark:text-slate-400">
                                    {children}
                                </div>

                                {/* Footer */}
                                {footer && (
                                    <div className="mt-6 flex justify-end gap-2">
                                        {footer}
                                    </div>
                                )}
                            </HeadlessDialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    );
}
