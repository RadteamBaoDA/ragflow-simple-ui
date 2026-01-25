import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { GuidelineDialog } from './GuidelineDialog';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth';
import { useGuideline } from '../hooks/useGuideline';

interface GuidelineHelpButtonProps {
    featureId: string;
    className?: string;
}

/**
 * @description Help button component for the header.
 * Triggers the guideline dialog for the current feature context.
 * 
 * @param {GuidelineHelpButtonProps} props - Component props.
 * @returns {JSX.Element | null} The rendered button or null if no guideline is available.
 */
export function GuidelineHelpButton({ featureId, className = '' }: GuidelineHelpButtonProps) {
    const [open, setOpen] = useState(false);
    const { t } = useTranslation();
    const { user } = useAuth();
    const { guideline } = useGuideline(featureId);

    // Don't render if no guideline exists for this feature
    if (!guideline) return null;

    // Don't render if user role doesn't match
    const roleHierarchy = { user: 1, leader: 2, admin: 3 };
    const userRoleLevel = roleHierarchy[user?.role || 'user'] || 1;
    const requiredRoleLevel = roleHierarchy[guideline.roleRequired] || 1;

    if (userRoleLevel < requiredRoleLevel) return null;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`flex items-center justify-center p-2 rounded-full transition-all duration-200 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-500 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${className}`}
                title={t('guideline.helpTooltip', 'Open User Guide')}
                aria-label={t('guideline.helpTooltip', 'Open User Guide')}
            >
                <HelpCircle size={20} />
            </button>

            <GuidelineDialog
                open={open}
                onClose={() => setOpen(false)}
                featureId={featureId}
            />
        </>
    );
}
