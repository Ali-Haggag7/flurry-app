import ImageKit from "imagekit";

/**
 * ImageKit Configuration
 * ----------------------
 * Initializes the ImageKit SDK for server-side image manipulation and uploading.
 *
 * @module config/imagekit
 * @requires process.env.IMAGEKIT_PUBLIC_KEY
 * @requires process.env.IMAGEKIT_PRIVATE_KEY
 * @requires process.env.IMAGEKIT_URL_ENDPOINT
 */

// Initialize ImageKit instance with credentials from environment variables.
// Note: Ensure these variables are defined in your .env file to avoid runtime errors.
const imagekit = new ImageKit({
    /**
     * Public Key:
     * Identifies the client/server to ImageKit. Safe to expose in some contexts,
     * but here it's part of the server config.
     */
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,

    /**
     * Private Key:
     * Used for generating authentication signatures.
     * ⚠️ SECURITY: Never expose this key on the client-side (frontend).
     */
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,

    /**
     * URL Endpoint:
     * The base URL for accessing your media assets.
     */
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

export default imagekit;