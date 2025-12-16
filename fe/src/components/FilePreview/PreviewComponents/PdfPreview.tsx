import React, { useState } from 'react';

interface PdfPreviewProps {
    url: string;
    title: string;
}

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
