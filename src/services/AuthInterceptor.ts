import type {AxiosError, AxiosInstance, AxiosResponse} from "axios";
import {type LoginResponse, RENEWED_TOKEN_EXPIRES_AT_HEADER, RENEWED_TOKEN_HEADER} from "../models";
import {clearStoredSession, readStoredSessionText, writeStoredSession} from "../session/sessionStore";

// Type for the unauthorized callback function
type UnauthorizedCallback = () => void;

// Called with the stored session after a response renewed its token
type SessionRenewedCallback = (session: LoginResponse) => void;

// Store for the unauthorized callback
let onUnauthorizedCallback: UnauthorizedCallback | null = null;

// Store for the session renewed callback
let onSessionRenewedCallback: SessionRenewedCallback | null = null;

// Timestamp of last unauthorized handling to debounce rapid 401 responses
let lastUnauthorizedHandledAt = 0;

// Debounce window in milliseconds — ignore repeated 401 responses within this period
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
 * Sets the callback called after a response renewed the session token: the backends answer every request the user triggered with
 * a fresh token (sliding session), the interceptor stores it, and the callback lets the SessionProvider update its state.
 * Called once by the SessionProvider.
 */
export function setOnSessionRenewedCallback(callback: SessionRenewedCallback): void {
    onSessionRenewedCallback = callback;
}

export function clearOnSessionRenewedCallback(): void {
    onSessionRenewedCallback = null;
}

/**
 * Reads a response header regardless of the header container Axios used (an AxiosHeaders instance or a plain object) and of its case.
 */
function headerValue(headers: unknown, name: string): string | null {
    if (!headers || typeof headers !== "object") {
        return null;
    }

    const container = headers as Record<string, unknown> & { get?: (name: string) => unknown };
    if (typeof container.get === "function") {
        const value = container.get(name);
        return typeof value === "string" && value.length > 0 ? value : null;
    }

    const wanted = name.toLowerCase();
    for (const key of Object.keys(container)) {
        if (key.toLowerCase() === wanted) {
            const value = container[key];
            return typeof value === "string" && value.length > 0 ? value : null;
        }
    }

    return null;
}

/**
 * Stores the renewed token and expiry a response carries in the persisted session, so that the next request and the expiry checks use
 * the token whose lifetime started at the user's last action. Responses without the header, or arriving while no session is stored
 * (after a logout), change nothing.
 */
export function adoptRenewedSession(headers: unknown): void {
    const token = headerValue(headers, RENEWED_TOKEN_HEADER);
    if (!token) {
        return;
    }

    const stored = readStoredSessionText();
    if (!stored) {
        return;
    }

    let session: LoginResponse;
    try {
        session = JSON.parse(stored) as LoginResponse;
    } catch {
        return;
    }

    if (session.token === token) {
        return;
    }

    const expiresAt = headerValue(headers, RENEWED_TOKEN_EXPIRES_AT_HEADER);
    const renewed: LoginResponse = {...session, token, expires_at: (expiresAt ?? session.expires_at) as LoginResponse["expires_at"]};
    // a renewal keeps the session where the login put it: remembered sessions stay remembered, window-only sessions stay window-only
    writeStoredSession(renewed);

    if (onSessionRenewedCallback) {
        try {
            onSessionRenewedCallback(renewed);
        } catch (e) {
            console.error("AuthInterceptor: Error in session renewed callback", e);
        }
    }
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
 * future 401 responses to be handled (unlike a permanent flag).
 */
function handleUnauthorized(): void {
    const now = Date.now();

    // Debounce: ignore if we recently handled an unauthorized response
    if (now - lastUnauthorizedHandledAt < UNAUTHORIZED_DEBOUNCE_MS) {
        return;
    }

    lastUnauthorizedHandledAt = now;

    // Clear the persisted session, wherever the login put it
    clearStoredSession();

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
 * Sets up axios response interceptor to handle 401 Unauthorized responses and renewed session tokens.
 * A 403 means the authenticated user lacks permission and must not terminate the
 * session. Only a 401 indicates that the session cannot be authenticated. Every other response,
 * successful or not, may carry a renewed token, which is stored (see adoptRenewedSession).
 *
 * @param axiosInstance - The axios instance to add the interceptor to
 * @returns The interceptor ID that can be used to eject the interceptor if needed
 */
export function setupAuthInterceptor(axiosInstance: AxiosInstance): number {
    return axiosInstance.interceptors.response.use(
        // On success, keep the renewed token and return the response
        (response: AxiosResponse) => {
            adoptRenewedSession(response.headers);
            return response;
        },
        // On error, only an unauthenticated response should terminate the session.
        (error: AxiosError) => {
            if (error.response?.status === 401) {
                handleUnauthorized();
            } else {
                adoptRenewedSession(error.response?.headers);
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
