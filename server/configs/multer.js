/**
 * @file multerConfig.js
 * @description Middleware configuration for handling `multipart/form-data`.
 *
 * Architecture Note:
 * This instance uses "Memory Storage". Files are stored in RAM as Buffers.
 * This is the optimal strategy when the immediate next step is uploading
 * the file to a cloud provider (e.g., ImageKit, Cloudinary, AWS S3)
 * because it avoids the I/O overhead of writing/reading temporary files on disk.
 */

import multer from "multer";

// --- Configuration ---

/**
 * Initialize Multer with Memory Storage.
 *
 * @const upload
 * @type {multer.Instance}
 *
 * Behavior:
 * 1. Intercepts the request.
 * 2. Parses the file stream.
 * 3. Stores the file in `req.file.buffer`.
 * 4. Passes control to the next controller (ImageKit uploader).
 */
const upload = multer({
    storage: multer.memoryStorage(), // Explicitly defined for code clarity
    // Future Optimization: Add limits here if needed (e.g., limits: { fileSize: 5 * 1024 * 1024 })
});

export default upload;