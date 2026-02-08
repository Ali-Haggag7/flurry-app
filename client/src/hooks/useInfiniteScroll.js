import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useInfiniteScroll Hook
 * ---------------------
 * Handles infinite scrolling logic.
 * * @param {Function} callback - Function to be called when the last element is visible.
 * @param {boolean} hasMore
 * @param {boolean} isLoading
 */
const useInfiniteScroll = (callback, hasMore, isLoading) => {
    const observer = useRef();

    // --- Intersection Observer ---
    const lastElementRef = useCallback(node => {
        if (isLoading) return;

        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            // Check if the last element is visible
            if (entries[0].isIntersecting && hasMore) {
                // Call the callback
                callback();
            }
        });

        if (node) observer.current.observe(node); // Observe the last element
    }, [isLoading, hasMore, callback]);

    return lastElementRef;
};

export default useInfiniteScroll;