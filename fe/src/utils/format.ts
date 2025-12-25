// Shared byte-size formatter for download/storage displays.
/**
 * Formats a file size in bytes to a human-readable string with units.
 * Uses base 1024 (IEC standard: KiB, MiB, GiB, etc.).
 * 
 * @param bytes The size in bytes.
 * @param decimals Number of decimal places (default: 1).
 * @returns Formatted string (e.g., "1.5 MiB").
 */
export const formatFileSize = (bytes: number, decimals: number = 1): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
