import type {ReactNode} from "react";
import {createContext, useContext, useEffect, useMemo, useState} from "react";
import {ActionResultEnum, type LoginRequest, type LoginResponse, type LoginStatus, VEMPAIN_LOCAL_STORAGE_KEY} from "../models";
import {AuthAPI, setOnUnauthorizedCallback, clearOnUnauthorizedCallback, resetUnauthorizedHandling} from "../services";

// Define the type for the session context
interface SessionContextType {
    userSession: LoginResponse | null;
    sessionLanguage: string;
    getSessionLanguage: () => string;
    setSessionLanguage: (language: string) => void;
    loginUser: (loginRequest: LoginRequest) => Promise<LoginStatus>;
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
    const [user, setUser] = useState<LoginResponse | null>(null);
    const [language, setLanguage] = useState<string>("en");
    const languageKey: string = "language";

    // Memoize authAPI instance to prevent creating a new instance on every render
    const authAPI = useMemo(() => new AuthAPI(baseURL), [baseURL]);

    // Check if user data exists in local storage on initial load
    useEffect(() => {
        const userData = localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY);

        if (userData) {
            setUser(JSON.parse(userData));
        }

        const languageData = localStorage.getItem(languageKey);
        if (languageData) {
            setLanguage(languageData);
        } else {
            setLanguage("en");
        }

    }, [VEMPAIN_LOCAL_STORAGE_KEY, languageKey]);

    // Set up the unauthorized callback to handle 401 responses from API calls
    useEffect(() => {
        setOnUnauthorizedCallback(() => {
            // Clear the user state
            setUser(null);
            // Clear local storage
            authAPI.logout();
            // Redirect to login page
            window.location.href = loginPath;
        });

        // Cleanup on unmount
        return () => {
            clearOnUnauthorizedCallback();
        };
    }, [loginPath, authAPI]);

    // Function to handle login
    const loginUser = (loginRequest: LoginRequest): Promise<LoginStatus> => {
        return authAPI.login(loginRequest)
                .then((jwtResponse) => {
                    localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(jwtResponse));
                    setUser(jwtResponse);
                    // Reset the unauthorized handling flag to allow future 401 responses to be handled
                    resetUnauthorizedHandling();
                    return {
                        status: ActionResultEnum.SUCCESS,
                        message: "Login successful"
                    };
                })
                .catch((error) => {
                    return {
                        status: ActionResultEnum.FAILURE,
                        message: "Failed to log on user: " + error.message
                    };
                });
    };

    // Function to handle logout
    const logoutUser = () => {
        setUser(null);
        authAPI.logout();
    };

    const setSessionLanguage = (language: string) => {
        setLanguage(language);
        localStorage.setItem(languageKey, language);
    };

    const getSessionLanguage = () => {
        return language;
    };

    function refreshUserSession(loginVO: LoginResponse): void {
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(loginVO));
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
