import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/Dialog';
import { useGuideline } from '../hooks/useGuideline';
import { useAuth } from '@/features/auth';
import { Play } from 'lucide-react';
import { LanguageCode } from '@/i18n';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GuidelineDialogProps {
    open: boolean;
    onClose: () => void;
    featureId: string;
}

export function GuidelineDialog({ open, onClose, featureId }: GuidelineDialogProps) {
    const { t, i18n } = useTranslation();
    const { guideline } = useGuideline(featureId);
    const { user } = useAuth();
    const [activeTabId, setActiveTabId] = useState<string>('overview');

    // Reset state when feature changes or dialog opens
    useEffect(() => {
        if (open) {
            setActiveTabId('overview');
        }
    }, [open, featureId]);

    const handleClose = () => {
        onClose();
    };

    if (!guideline) return null;

    // Role check
    const roleHierarchy = { user: 1, leader: 2, admin: 3 };
    const userRoleLevel = roleHierarchy[user?.role || 'user'] || 1;
    const requiredRoleLevel = roleHierarchy[guideline.roleRequired] || 1;

    if (userRoleLevel < requiredRoleLevel) {
        return null; // Or render access denied
    }

    const currentLang = (i18n.language || 'en') as LanguageCode & string;
    const activeTab = guideline.tabs.find(t => t.tabId === activeTabId);

    // Resolve localized strings helper
    const getLocPath = (record: Record<string, string>) => {
        return record[currentLang] || record['en'] || '';
    };

    // Helper for string array localization
    const getLocList = (record?: Record<string, string[]>) => {
        if (!record) return [];
        return record[currentLang] || record['en'] || [];
    };


    return (
        <Dialog
            open={open}
            onClose={handleClose}
            title={t(`guideline.modules.${featureId}.title`, { defaultValue: getLocPath(guideline.overview).split('.')[0] })} // Fallback title
            maxWidth="4xl"
            className="h-[80vh]"
        >
            <div className="flex h-full flex-col lg:flex-row gap-4">
                {/* Sidebar / Tabs */}
                <div className="w-full lg:w-64 shrink-0 border-r dark:border-slate-700 pr-4 flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTabId('overview')}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium
              ${activeTabId === 'overview'
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                    >
                        {t('guideline.overview', 'Overview')}
                    </button>

                    <div className="my-2 border-t dark:border-slate-700" />

                    <div className="flex flex-col gap-1 overflow-y-auto flex-1">
                        {guideline.tabs.map(tab => (
                            <button
                                key={tab.tabId}
                                onClick={() => {
                                    setActiveTabId(tab.tabId);
                                }}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors text-sm
                  ${activeTabId === tab.tabId
                                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-medium'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-500'
                                    }`}
                            >
                                {getLocPath(tab.tabTitle)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pl-1">
                    {activeTabId === 'overview' ? (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="prose dark:prose-invert max-w-none">
                                <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">
                                    {t('guideline.welcome', 'Welcome')}
                                </h3>
                                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {getLocPath(guideline.overview)}
                                </p>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 mt-8">
                                <h4 className="font-medium text-slate-900 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <Play size={18} className="text-blue-500" />
                                    {t('guideline.quickStart', 'Quick Start')}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {guideline.tabs.slice(0, 4).map(tab => ( // Show first 4 features as quick links
                                        <button
                                            key={tab.tabId}
                                            onClick={() => {
                                                setActiveTabId(tab.tabId);
                                            }}
                                            className="p-3 text-left bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-900 group"
                                        >
                                            <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                                {getLocPath(tab.tabTitle)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : activeTab ? (
                        <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6 pb-4 border-b dark:border-slate-700">
                                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                                    {getLocPath(activeTab.tabTitle)}
                                </h3>
                            </div>

                            {/* Content - Scrollable List of Steps */}
                            <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                                {activeTab.steps.map((step, index) => (
                                    <div key={step.id} className="group">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm mt-1">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-lg text-slate-900 dark:text-slate-100 mb-2">
                                                    {getLocPath(step.title)}
                                                </h4>
                                                <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                                                    {getLocPath(step.description)}
                                                </p>

                                                {/* Detailed Steps List */}
                                                {step.details && (
                                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-100 dark:border-slate-800">
                                                        <ul className="space-y-2">
                                                            {getLocList(step.details).map((detail, idx) => (
                                                                <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                                                    <span>•</span>
                                                                    <ReactMarkdown
                                                                        remarkPlugins={[remarkGfm]}
                                                                        components={{
                                                                            p: ({ children }: any) => <span className="inline">{children}</span>
                                                                        }}
                                                                    >
                                                                        {detail.replace(/^\d+\.\s*/, '')}
                                                                    </ReactMarkdown>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer Navigation */}
                            <div className="flex justify-end mt-4 pt-4 border-t dark:border-slate-700">
                                <button
                                    onClick={handleClose}
                                    className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                >
                                    {t('common.close', 'Close')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full animate-in fade-in duration-300">
                            <div className="flex-1" />
                            <div className="flex justify-end mt-auto pt-4 border-t dark:border-slate-700">
                                <button
                                    onClick={handleClose}
                                    className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                >
                                    {t('common.close', 'Close')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
