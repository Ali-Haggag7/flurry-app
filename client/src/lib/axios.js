/**
 * @file axiosInstance.ts
 * Configured to use VITE_API_URL dynamically.
 */

import axios from "axios";

// Priority: Production Env -> Local Fallback
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

export default axiosInstance;