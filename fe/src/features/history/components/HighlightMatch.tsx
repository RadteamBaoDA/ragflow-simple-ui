/**
 * @fileoverview Highlight matching text in search results.
 * @module features/history/components/HighlightMatch
 */

/**
 * Props for the HighlightMatch component.
 */
interface HighlightMatchProps {
    /** Text to display. */
    text: string
    /** Search query to highlight within the text. */
    query: string
}

/**
 * Highlights portions of text that match the search query.
 * @param props - Component props.
 * @returns Rendered text with highlighted matches.
 */
export const HighlightMatch = ({ text, query }: HighlightMatchProps) => {
    // Return plain text if no query or text
    if (!query || !text) return <>{text}</>

    // Split text by the query (case-insensitive) and wrap matches in <mark>
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-slate-100 rounded-sm px-0.5">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </span>
    )
}
