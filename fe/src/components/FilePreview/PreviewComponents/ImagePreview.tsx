import React, { useState } from 'react';

interface ImagePreviewProps {
    url: string;
    alt: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ url, alt }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p>Failed to load image</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center h-full w-full p-4">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-950 z-0">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            )}
            <img
                src={url}
                alt={alt}
                className={`max-w-full max-h-full object-contain shadow-lg rounded-lg transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setLoading(false)}
                onError={() => {
                    setLoading(false);
                    setError(true);
                }}
            />
        </div>
    );
};
