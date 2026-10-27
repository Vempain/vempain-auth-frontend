import type {ReactNode} from "react";
import {createContext, useContext, useEffect, useMemo, useState} from "react";
import {ActionResultEnum, type LoginRequest, type LoginResponse, type LoginStatus} from "../models";
import {
    AuthAPI,
    clearOnSessionRenewedCallback,
    clearOnUnauthorizedCallback,
    resetUnauthorizedHandling,
    setLoginPath,
    setOnSessionRenewedCallback,
    setOnUnauthorizedCallback
} from "../services";
import {isSessionExpired} from "./sessionExpiration";
import {clearStoredSession, readStoredSessionText, writeStoredSession} from "./sessionStore";

const LANGUAGE_STORAGE_KEY = "language";

export function getStoredSession(): LoginResponse | null {
    const userData = readStoredSessionText();

    if (!userData) {
        return null;
    }

    try {
        const session = JSON.parse(userData) as LoginResponse;
        if (isSessionExpired(session)) {
            clearStoredSession();
            return null;
        }

        return session;
    } catch {
        clearStoredSession();
        return null;
    }
}

function getStoredLanguage(): string {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "en";
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

// Define the type for the session context
interface SessionContextType {
    userSession: LoginResponse | null;
    sessionLanguage: string;
    getSessionLanguage: () => string;
    setSessionLanguage: (language: string) => void;
    /**
     * Logs in and persists the session: with `remember` (the "Remember me" box of the login form, the default) across browser restarts
     * in local storage, otherwise in session storage for this browser window only.
     */
    loginUser: (loginRequest: LoginRequest, remember?: boolean) => Promise<LoginStatus>;
    logoutUser: () => void;
    refreshUserSession: (loginVO: LoginResponse) => void;
}

// Add props type for SessionProvider
interface SessionProviderProps {
    baseURL: string;
    children: ReactNode;
    /** Path to redirect to when session expires or 401 is received. Defaults to "/login" */
    loginPath?: string;
}

// Create a context to hold the session information
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Create a SessionProvider component
export function SessionProvider({baseURL, children, loginPath = "/login"}: SessionProviderProps) {
    const [user, setUser] = useState<LoginResponse | null>(() => getStoredSession());
    const [language, setLanguage] = useState<string>(() => getStoredLanguage());

    // Memoize authAPI instance to prevent creating a new instance on every render
    const authAPI = useMemo(() => new AuthAPI(baseURL), [baseURL]);

    // Set up the unauthorized callback to handle 401 responses from API calls
    useEffect(() => {
        // Configure the login path for fallback redirect (works even if callback fails)
        setLoginPath(loginPath);

        setOnUnauthorizedCallback(() => {
            // Clear the user state
            setUser(null);
            // Clear local storage
            authAPI.logout();
            // Redirect to login page
            window.location.href = loginPath;
        });

        // The backends renew the session on every request the user triggers (sliding session); the interceptor stores the
        // renewed token and tells us, so the expiry the route guard checks is the one counted from the last action
        setOnSessionRenewedCallback(renewed => {
            setUser(renewed);
        });

        // Cleanup on unmount
        return () => {
            clearOnUnauthorizedCallback();
            clearOnSessionRenewedCallback();
        };
    }, [loginPath, authAPI]);

    // Function to handle login
    async function loginUser(loginRequest: LoginRequest, remember: boolean = true): Promise<LoginStatus> {
        try {
            const jwtResponse = await authAPI.login(loginRequest, remember);
            writeStoredSession(jwtResponse, remember);
            setUser(jwtResponse);
            // Reset the unauthorized handling flag to allow future 401 responses to be handled
            resetUnauthorizedHandling();
            return {
                status: ActionResultEnum.SUCCESS,
                message: "Login successful"
            };
        } catch (error: unknown) {
            return {
                status: ActionResultEnum.FAILURE,
                message: "Failed to log on user: " + getErrorMessage(error)
            };
        }
    }

    // Function to handle logout
    const logoutUser = () => {
        setUser(null);
        authAPI.logout();
    };

    const setSessionLanguage = (language: string) => {
        setLanguage(language);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    };

    const getSessionLanguage = () => {
        return language;
    };

    function refreshUserSession(loginVO: LoginResponse): void {
        writeStoredSession(loginVO);
        setUser(loginVO);
    };

    const contextValue: SessionContextType = {
        userSession: user,
        sessionLanguage: language,
        getSessionLanguage,
        setSessionLanguage,
        loginUser,
        logoutUser,
        refreshUserSession
    };

    return (
            <SessionContext.Provider value={contextValue} key={"MainContext"}>
                {children}
            </SessionContext.Provider>
    );
}

// Custom hook to use session data in components
export function useSession(): SessionContextType {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error("useSession must be used within a SessionProvider");
    }

    return context;
}
