/**
 * Builds a nested recursive tree structure from a flat array of comments.
 *
 * @param {Array<Object>} comments - The raw flat array of comment objects from the API.
 * @returns {Array<Object>} - The structured tree array with root comments containing nested `children`.
 */
export const buildCommentTree = (comments) => {
    // 1. Fail-safe early return
    if (!Array.isArray(comments) || comments.length === 0) return [];

    const commentMap = {};
    const roots = [];

    /**
     * Helper to safely extract the ID whether it's a string or a populated object.
     * Handles MongoDB/Mongoose scenarios where parentId might be populated.
     * @param {string|Object} id 
     */
    const getId = (id) => (typeof id === 'object' && id !== null ? id._id : id);

    // 2. Initialization Phase: Create a map for O(1) lookup
    // We create a shallow copy to avoid mutating the original array and initialize children.
    for (const comment of comments) {
        commentMap[comment._id] = { ...comment, children: [] };
    }

    // 3. Construction Phase: Link children to parents
    for (const comment of comments) {
        const parentId = getId(comment.parentId);
        const currentNode = commentMap[comment._id];

        if (parentId && commentMap[parentId]) {
            // If parent exists in the map, push current node to parent's children
            commentMap[parentId].children.push(currentNode);
        } else if (!parentId) {
            // If no parentId, it's a root node
            roots.push(currentNode);
        }
    }

    // 4. Sorting Phase:
    // Roots are sorted by Newest First (Descending)
    roots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    /**
     * Recursive function to sort replies chronologically (Oldest First).
     * This ensures conversation threads read naturally from top to bottom.
     * @param {Array} list 
     */
    const sortReplies = (list) => {
        if (!list || list.length === 0) return;

        // Sort current level: Oldest -> Newest
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Recursively sort children of current level
        for (const node of list) {
            if (node.children?.length > 0) {
                sortReplies(node.children);
            }
        }
    };

    // Apply recursive sorting to all children of the roots
    roots.forEach((root) => sortReplies(root.children));

    return roots;
};