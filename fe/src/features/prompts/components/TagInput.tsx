/**
 * @fileoverview TagInput Component
 * 
 * A multi-tag input component with:
 * - Select with tags mode for stable focus
 * - Search with debouncing
 * - Creates new tags with random colors
 * - Displays selected tags with colored chips
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, Spin } from 'antd';
import { promptService } from '../api/promptService';
import { PromptTag } from '../types/prompt';

// ============================================================================
// Types
// ============================================================================

interface TagInputProps {
    /** Currently selected tag names */
    value?: string[];
    /** Callback when tags change */
    onChange?: (tags: string[]) => void;
    /** Placeholder text */
    placeholder?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEBOUNCE_DELAY = 500; // ms

/**
 * Dark color palette that looks good with white text.
 */
const DARK_COLOR_PALETTE = [
    '#1E40AF', // Blue 800
    '#1E3A8A', // Blue 900
    '#059669', // Emerald 600
    '#047857', // Emerald 700
    '#7C3AED', // Violet 600
    '#6D28D9', // Violet 700
    '#DB2777', // Pink 600
    '#BE185D', // Pink 700
    '#DC2626', // Red 600
    '#B91C1C', // Red 700
    '#D97706', // Amber 600
    '#B45309', // Amber 700
    '#0891B2', // Cyan 600
    '#0E7490', // Cyan 700
    '#4F46E5', // Indigo 600
    '#4338CA', // Indigo 700
    '#16A34A', // Green 600
    '#15803D', // Green 700
    '#9333EA', // Purple 600
    '#7E22CE', // Purple 700
    '#EA580C', // Orange 600
    '#C2410C', // Orange 700
    '#0D9488', // Teal 600
    '#0F766E', // Teal 700
    '#2563EB', // Blue 600
    '#1D4ED8', // Blue 700
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a random dark color from the palette.
 * @returns Random hex color string that works well with white text
 */
const generateRandomColor = (): string => {
    const index = Math.floor(Math.random() * DARK_COLOR_PALETTE.length);
    return DARK_COLOR_PALETTE[index] ?? '#1E40AF';
};

// ============================================================================
// Component
// ============================================================================

export const TagInput: React.FC<TagInputProps> = ({
    value = [],
    onChange,
    placeholder
}) => {
    const { t } = useTranslation();
    const [options, setOptions] = useState<PromptTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [tagColorMap, setTagColorMap] = useState<Record<string, string>>({});
    const [searchValue, setSearchValue] = useState('');
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    // ========================================================================
    // Data Fetching
    // ========================================================================

    /**
     * Fetch newest tags on component mount.
     */
    useEffect(() => {
        fetchNewestTags();
    }, []);

    /**
     * Fetch colors for pre-selected tags that aren't in the color map yet.
     */
    useEffect(() => {
        const fetchColorsForExistingTags = async () => {
            // Find tags that don't have colors in the map
            const tagsWithoutColors = value.filter(tagName => !tagColorMap[tagName]);
            if (tagsWithoutColors.length === 0) return;

            try {
                // Search for these tags to get their colors
                const tags = await promptService.searchTags('', 50);
                const colorMap: Record<string, string> = {};
                tags.forEach(tag => {
                    if (tagsWithoutColors.includes(tag.name)) {
                        colorMap[tag.name] = tag.color;
                    }
                });
                // Generate random colors for any remaining tags not found
                tagsWithoutColors.forEach(tagName => {
                    if (!colorMap[tagName]) {
                        colorMap[tagName] = generateRandomColor();
                    }
                });
                setTagColorMap(prev => ({ ...prev, ...colorMap }));
            } catch (error) {
                console.error('Failed to fetch tag colors:', error);
                // Fallback: generate random colors
                const colorMap: Record<string, string> = {};
                tagsWithoutColors.forEach(tagName => {
                    colorMap[tagName] = generateRandomColor();
                });
                setTagColorMap(prev => ({ ...prev, ...colorMap }));
            }
        };

        if (value.length > 0) {
            fetchColorsForExistingTags();
        }
    }, [value]);

    /**
     * Fetch 5 newest tags from the API.
     */
    const fetchNewestTags = async () => {
        try {
            const tags = await promptService.getNewestTags(10);
            setOptions(tags);
            // Update color map from fetched tags
            const colorMap: Record<string, string> = {};
            tags.forEach(tag => {
                colorMap[tag.name] = tag.color;
            });
            setTagColorMap(prev => ({ ...prev, ...colorMap }));
        } catch (error) {
            console.error('Failed to fetch newest tags:', error);
        }
    };

    /**
     * Search tags by query with debouncing.
     */
    const handleSearch = (query: string) => {
        setSearchValue(query);

        // Clear previous debounce
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        // If empty, show newest tags immediately
        if (!query.trim()) {
            fetchNewestTags();
            return;
        }

        // Debounce the search API call
        debounceTimeout.current = setTimeout(async () => {
            setLoading(true);
            try {
                const tags = await promptService.searchTags(query, 10);
                setOptions(tags);
                // Update color map
                const colorMap: Record<string, string> = {};
                tags.forEach(tag => {
                    colorMap[tag.name] = tag.color;
                });
                setTagColorMap(prev => ({ ...prev, ...colorMap }));
            } catch (error) {
                console.error('Failed to search tags:', error);
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_DELAY);
    };

    // ========================================================================
    // Handlers
    // ========================================================================

    /**
     * Handle tag selection/creation.
     */
    const handleChange = async (newValues: string[]) => {
        // Find new tags that were just added
        const addedTags = newValues.filter(v => !value.includes(v));

        // For each new tag, check if it exists or create it
        for (const tagName of addedTags) {
            const existingTag = options.find(o => o.name === tagName);
            if (!existingTag) {
                // Create new tag with random color
                try {
                    const color = generateRandomColor();
                    const newTag = await promptService.createTag(tagName, color);
                    setTagColorMap(prev => ({ ...prev, [newTag.name]: newTag.color }));
                } catch (error) {
                    console.error('Failed to create tag:', error);
                }
            } else if (!tagColorMap[tagName]) {
                setTagColorMap(prev => ({ ...prev, [tagName]: existingTag.color }));
            }
        }

        onChange?.(newValues);
        setSearchValue('');
    };

    /**
     * Get tag style with color.
     */
    const tagRender = (props: any) => {
        const { label, value: tagValue, closable, onClose } = props;
        const color = tagColorMap[tagValue] || generateRandomColor();

        return (
            <span
                style={{
                    backgroundColor: color,
                    borderColor: color,
                    color: '#fff',
                    padding: '0 7px',
                    borderRadius: '4px',
                    marginRight: 3,
                    display: 'inline-flex',
                    alignItems: 'center'
                }}
            >
                {label}
                {closable && (
                    <span
                        onClick={onClose}
                        style={{ marginLeft: 4, cursor: 'pointer' }}
                    >
                        ×
                    </span>
                )}
            </span>
        );
    };

    /**
     * Build select options from tags - include all options so selected ones show with color dots.
     */
    const selectOptions = useMemo(() => {
        return options.map(tag => ({
            value: tag.name,
            label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: tag.color
                        }}
                    />
                    <span>{tag.name}</span>
                </div>
            )
        }));
    }, [options]);

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <Select
            mode="tags"
            style={{ width: '100%' }}
            placeholder={placeholder || t('prompts.form.searchTags')}
            value={value}
            onChange={handleChange}
            onSearch={handleSearch}
            searchValue={searchValue}
            onFocus={fetchNewestTags}
            loading={loading}
            tagRender={tagRender}
            options={selectOptions}
            filterOption={false}
            notFoundContent={loading ? <Spin size="small" /> : null}
            tokenSeparators={[',']}
        />
    );
};

export default TagInput;

