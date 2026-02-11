/**
 * @fileoverview Empty state placeholder when no session is selected.
 * @module features/history/components/EmptyState
 */
import type { LucideIcon } from 'lucide-react'

/**
 * Props for the EmptyState component.
 */
interface EmptyStateProps {
    /** Lucide icon component to display. */
    icon: LucideIcon
    /** Main title text. */
    title: string
    /** Subtitle/hint text. */
    subtitle: string
    /** Gradient color class for the radial glow effect. */
    glowColor?: string
}

/**
 * Centered empty state with icon, title, and subtitle.
 * @param props - Component props.
 * @returns Rendered empty state.
 */
export const EmptyState = ({
    icon: Icon,
    title,
    subtitle,
    glowColor = 'rgba(120,119,198,0.3)',
}: EmptyStateProps) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/50">
            <div className="w-32 h-32 bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
                <div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at 50% 120%, ${glowColor}, rgba(255,255,255,0))` }}
                />
                <Icon size={48} className="text-slate-400 dark:text-slate-500 relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
            <p className="text-slate-500 dark:text-slate-300 max-w-xs text-center">
                {subtitle}
            </p>
        </div>
    )
}
