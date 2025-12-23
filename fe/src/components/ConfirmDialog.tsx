import React, { createContext, useContext, useState, ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
};

interface ConfirmProviderProps {
    children: ReactNode;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const confirm = (opts: ConfirmOptions): Promise<boolean> => {
        setOptions(opts);
        setIsOpen(true);
        return new Promise((resolve) => {
            setResolvePromise(() => resolve);
        });
    };

    const handleConfirm = () => {
        if (resolvePromise) {
            resolvePromise(true);
        }
        setIsOpen(false);
        setOptions(null);
        setResolvePromise(null);
    };

    const handleCancel = () => {
        if (resolvePromise) {
            resolvePromise(false);
        }
        setIsOpen(false);
        setOptions(null);
        setResolvePromise(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    const getVariantStyles = () => {
        const variant = options?.variant || 'warning';
        switch (variant) {
            case 'danger':
                return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
            case 'warning':
                return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
            case 'info':
                return 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500';
            default:
                return 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500';
        }
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {isOpen && options && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                    onClick={handleCancel}
                    onKeyDown={handleKeyDown}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        aria-describedby="confirm-message"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3
                                id="confirm-title"
                                className="text-lg font-semibold text-gray-900 dark:text-white"
                            >
                                {options.title || t('dialog.confirmTitle')}
                            </h3>
                            <button
                                onClick={handleCancel}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                aria-label={t('dialog.close')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Message */}
                        <div
                            id="confirm-message"
                            className="mb-6 text-gray-700 dark:text-gray-300"
                        >
                            {options.message}
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                            >
                                {options.cancelText || t('dialog.cancel')}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${getVariantStyles()}`}
                                autoFocus
                            >
                                {options.confirmText || t('dialog.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
