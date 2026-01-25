/**
 * @file axiosInstance.ts
 * @description Configures the global Axios instance for API communication.
 * Establishes the Base URL based on the Vite environment variables.
 * @module API
 */

import axios from "axios";

// --- Configuration ---

/**
 * Define the Base URL for the API.
 * Priority:
 * 1. `import.meta.env.VITE_API_URL` (Production/Environment specific)
 * 2. Fallback to `http://localhost:4000/api` (Local development default)
 */
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// --- Instance Creation ---

/**
 * Singleton Axios instance.
 * specific configuration for the application.
 *
 * @see https://axios-http.com/docs/instance
 */
const axiosInstance = axios.create({
    baseURL: BASE_URL,
    // Note: Enable `withCredentials` if the backend requires cookies (e.g., specific Auth flows).
    // withCredentials: true,
});

export default axiosInstance;