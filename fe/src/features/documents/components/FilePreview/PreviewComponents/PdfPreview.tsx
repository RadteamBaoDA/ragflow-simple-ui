/**
 * @fileoverview Component for previewing PDF files using the browser's native PDF viewer.
 */

import React, { useState } from 'react';

/**
 * @description Props for PdfPreview component.
 */
interface PdfPreviewProps {
    /** URL of the PDF to display */
    url: string;
    /** Title attribute for the iframe */
    title: string;
}

/**
 * @description Renders a PDF preview using an iframe.
 * Shows a loading spinner until the iframe content is loaded.
 *
 * @param {PdfPreviewProps} props - Component props.
 * @returns {JSX.Element} PDF preview component.
 */
export const PdfPreview: React.FC<PdfPreviewProps> = ({ url, title }) => {
    const [loading, setLoading] = useState(true);

    return (
        <div className="absolute inset-0 w-full h-full z-10">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-950 z-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            )}
            <iframe
                src={`${url}#view=FitH`}
                title={title}
                className="w-full h-full border-0"
                onLoad={() => setLoading(false)}
            />
        </div>
    );
};
