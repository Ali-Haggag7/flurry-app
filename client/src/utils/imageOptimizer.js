/**
 * Utility: optimizeImage
 * ------------------------------------------------------------------
 * Optimizes ImageKit URLs by dynamically appending transformation 
 * parameters for resizing and quality compression.
 * * Used to reduce bandwidth usage and improve LCP (Largest Contentful Paint).
 *
 * @param {string} url - The original image URL.
 * @param {number} [width=500] - The target width for the image (default: 500px).
 * @returns {string} - The optimized URL with transformation params, or original URL if ineligible.
 */
export const optimizeImage = (url, width = 500) => {
    // --- Validation Checks ---

    // Return original if URL is invalid or not from ImageKit
    if (!url || !url.includes('ik.imagekit.io')) return url;

    // Return original if transformation parameters already exist to prevent double-processing
    if (url.includes('?tr=')) return url;

    // --- Apply Optimization ---

    // Append width transformation and set quality to 80%
    return `${url}?tr=w-${width},q-80`;
};