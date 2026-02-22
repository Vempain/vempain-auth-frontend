import type {AxiosError, AxiosInstance} from "axios";
import {VEMPAIN_LOCAL_STORAGE_KEY} from "../models";

// Type for the unauthorized callback function
type UnauthorizedCallback = () => void;

// Store for the unauthorized callback
let onUnauthorizedCallback: UnauthorizedCallback | null = null;

// Timestamp of last unauthorized handling to debounce rapid 401/403 responses
let lastUnauthorizedHandledAt = 0;

// Debounce window in milliseconds — ignore repeated 401/403 within this period
const UNAUTHORIZED_DEBOUNCE_MS = 2000;

// Default login path for fallback redirect
let configuredLoginPath = "/login";

/**
 * Sets the callback function to be called when a 401 Unauthorized response is received.
 * This should be called once during application initialization, typically in the SessionProvider
 * or at the app root level.
 *
 * @param callback - The function to call when unauthorized (typically logout and redirect)
 */
export function setOnUnauthorizedCallback(callback: UnauthorizedCallback): void {
    onUnauthorizedCallback = callback;
}

/**
 * Clears the unauthorized callback. Call this during cleanup if needed.
 */
export function clearOnUnauthorizedCallback(): void {
    onUnauthorizedCallback = null;
}

/**
 * Sets the login path used for the fallback redirect when no callback is registered.
 * This is automatically called by SessionProvider, but can also be set manually.
 *
 * @param path - The login page path (e.g., "/login")
 */
export function setLoginPath(path: string): void {
    configuredLoginPath = path;
}

/**
 * Resets the unauthorized handling state. This can be used after a successful login
 * to allow future 401 responses to be handled again.
 */
export function resetUnauthorizedHandling(): void {
    lastUnauthorizedHandledAt = 0;
}

/**
 * Handles the unauthorized response by clearing the session and calling the callback.
 * Uses a time-based debounce to prevent multiple rapid redirects while still allowing
 * future 401/403 responses to be handled (unlike a permanent flag).
 */
function handleUnauthorized(): void {
    const now = Date.now();

    // Debounce: ignore if we recently handled an unauthorized response
    if (now - lastUnauthorizedHandledAt < UNAUTHORIZED_DEBOUNCE_MS) {
        return;
    }

    lastUnauthorizedHandledAt = now;

    // Clear the session from local storage
    localStorage.removeItem(VEMPAIN_LOCAL_STORAGE_KEY);

    // Call the callback if set
    if (onUnauthorizedCallback) {
        try {
            onUnauthorizedCallback();
        } catch (e) {
            console.error("AuthInterceptor: Error in unauthorized callback, performing immediate fallback redirect", e);
            // Perform immediate fallback redirect if the unauthorized callback fails
            window.location.href = configuredLoginPath;
        }
    } else {
        // Fallback: if no callback is registered (e.g., SessionProvider hasn't mounted yet,
        // or there's a module duplication issue), perform a direct redirect
        console.warn("AuthInterceptor: No unauthorized callback registered, performing fallback redirect to", configuredLoginPath);
        window.location.href = configuredLoginPath;
    }
}

/**
 * Sets up axios response interceptor to handle 401 Unauthorized responses.
 * This interceptor will automatically trigger logout when the server returns 401 or 403.
 *
 * @param axiosInstance - The axios instance to add the interceptor to
 * @returns The interceptor ID that can be used to eject the interceptor if needed
 */
export function setupAuthInterceptor(axiosInstance: AxiosInstance): number {
    return axiosInstance.interceptors.response.use(
        // On success, just return the response
        (response) => response,
        // On error, check if it's a 401/403 and handle accordingly
        (error: AxiosError) => {
            if (error.response?.status === 401
                || error.response?.status === 403) {
                handleUnauthorized();
            }
            // Always reject the promise so the calling code can handle the error if needed
            return Promise.reject(error);
        }
    );
}

/**
 * Removes the auth interceptor from an axios instance.
 *
 * @param axiosInstance - The axios instance to remove the interceptor from
 * @param interceptorId - The ID returned by setupAuthInterceptor
 */
export function removeAuthInterceptor(axiosInstance: AxiosInstance, interceptorId: number): void {
    axiosInstance.interceptors.response.eject(interceptorId);
}

