import type {AxiosInstance, AxiosError} from "axios";
import {VEMPAIN_LOCAL_STORAGE_KEY} from "../models";

// Type for the unauthorized callback function
type UnauthorizedCallback = () => void;

// Store for the unauthorized callback
let onUnauthorizedCallback: UnauthorizedCallback | null = null;

// Flag to prevent multiple redirects
let isHandlingUnauthorized = false;

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
 * Resets the unauthorized handling flag. This can be used after a successful login
 * to allow future 401 responses to be handled again.
 */
export function resetUnauthorizedHandling(): void {
    isHandlingUnauthorized = false;
}

/**
 * Handles the unauthorized response by clearing the session and calling the callback.
 */
function handleUnauthorized(): void {
    // Prevent multiple simultaneous handling
    if (isHandlingUnauthorized) {
        return;
    }

    isHandlingUnauthorized = true;

    // Clear the session from local storage
    localStorage.removeItem(VEMPAIN_LOCAL_STORAGE_KEY);

    // Call the callback if set
    if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
    }

    // Reset the flag after a short delay to allow for any cleanup
    setTimeout(() => {
        isHandlingUnauthorized = false;
    }, 1000);
}

/**
 * Sets up axios response interceptor to handle 401 Unauthorized responses.
 * This interceptor will automatically trigger logout when the server returns 401.
 *
 * @param axiosInstance - The axios instance to add the interceptor to
 * @returns The interceptor ID that can be used to eject the interceptor if needed
 */
export function setupAuthInterceptor(axiosInstance: AxiosInstance): number {
    return axiosInstance.interceptors.response.use(
        // On success, just return the response
        (response) => response,
        // On error, check if it's a 401 and handle accordingly
        (error: AxiosError) => {
            if (error.response?.status === 401) {
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

