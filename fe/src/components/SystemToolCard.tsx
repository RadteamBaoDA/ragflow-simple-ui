/**
 * @fileoverview System tool card component for admin dashboard.
 * 
 * Displays a clickable card for a system monitoring tool.
 * Opens the tool's URL in a new tab when clicked.
 * Includes icon, name, and description.
 * 
 * @module components/SystemToolCard
 */

import { ExternalLink } from 'lucide-react';
import { SystemTool } from '../services/systemToolsService';

// ============================================================================
// Types
// ============================================================================

/** Props for SystemToolCard component */
interface SystemToolCardProps {
    /** System tool data to display */
    tool: SystemTool;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Card component for displaying a system monitoring tool.
 * 
 * Features:
 * - Displays tool icon with fallback handling
 * - Shows tool name and description
 * - Opens tool URL in new tab on click
 * - External link indicator on hover
 * - Hover animations and styling
 * 
 * @param tool - The system tool to display
 */
const SystemToolCard = ({ tool }: SystemToolCardProps) => {
    /**
     * Open tool URL in a new browser tab.
     * Uses noopener,noreferrer for security.
     */
    const handleClick = () => {
        window.open(tool.url, '_blank', 'noopener,noreferrer');
    };

    /**
     * Build full icon URL, handling backend-served static files.
     * 
     * @param iconPath - The icon path (may be relative to backend)
     * @returns Full URL for the icon
     */
    const getIconUrl = (iconPath: string) => {
        // Handle backend static paths
        if (iconPath.startsWith('/static')) {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
            return `${API_BASE_URL}${iconPath}`;
        }
        return iconPath;
    };

    return (
        <button
            onClick={handleClick}
            className="group relative flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 hover:shadow-lg transition-all duration-200 cursor-pointer min-h-[180px]"
            title={tool.description}
        >
            {/* Icon */}
            <div className="w-16 h-16 mb-4 flex items-center justify-center">
                <img
                    src={getIconUrl(tool.icon)}
                    alt={`${tool.name} icon`}
                    className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-110"
                    onError={(e) => {
                        // Fallback to backend-hosted default icon if image fails to load
                        const target = e.target as HTMLImageElement;
                        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
                        const fallbackUrl = `${API_BASE_URL}/static/icons/default-tool.svg`;

                        // Prevent infinite loop if fallback also fails
                        if (target.src !== fallbackUrl) {
                            target.src = fallbackUrl;
                        }
                    }}
                />
            </div>

            {/* Tool Name */}
            <h3 className="text-base font-semibold text-gray-900 dark:text-white text-center mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {tool.name}
            </h3>

            {/* Description */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center line-clamp-2">
                {tool.description}
            </p>

            {/* External link indicator */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-4 h-4 text-primary-500 dark:text-primary-400" />
            </div>
        </button>
    );
};

export default SystemToolCard;
