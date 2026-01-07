/**
 * @fileoverview Shared formatting utilities.
 * 
 * Provides consistent formatting for:
 * - File sizes (B, KiB, MiB, etc.)
 */

/**
 * Formats a file size in bytes to a human-readable string with units.
 * Uses binary prefixes (base 1024) according to IEC standard.
 * 
 * @param {number} bytes - The size in bytes to format.
 * @param {number} [decimals=1] - Number of decimal places to include.
 * @returns {string} Formatted string (e.g., "1.5 MiB", "102.4 KiB").
 * @description Automatically selects the appropriate unit (B, KiB, MiB, etc.) based on magnitude.
 * 
 * @example
 * ```ts
 * formatFileSize(1572864) // returns "1.5 MiB"
 * formatFileSize(1024, 0) // returns "1 KiB"
 * ```
 */
export const formatFileSize = (bytes: number, decimals: number = 1): string => {
    // Handle zero case explicitly
    if (bytes === 0) return '0 B';

    const k = 1024;
    // Ensure decimals is non-negative
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    // Calculate which unit index to use
    // log base 1024 of bytes gives us the magnitude index
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Calculate value in chosen unit and append unit string
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
