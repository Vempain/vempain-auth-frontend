import type {ReactNode} from "react";
import {createContext, useContext, useEffect, useState} from "react";
import {ActionResultEnum, type LoginRequest, type LoginStatus, type LoginVO, VEMPAIN_LOCAL_STORAGE_KEY} from "../models";
import {AuthAPI} from "../services";

// Define the type for the session context
interface SessionContextType {
    userSession: LoginVO | null;
    sessionLanguage: string;
    getSessionLanguage: () => string;
    setSessionLanguage: (language: string) => void;
    loginUser: (loginRequest: LoginRequest) => Promise<LoginStatus>;
    logoutUser: () => void;
    refreshUserSession: (loginVO: LoginVO) => void;
}

// Add props type for SessionProvider
interface SessionProviderProps {
    baseURL: string;
    children: ReactNode;
}

// Create a context to hold the session information
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Create a SessionProvider component
export function SessionProvider({baseURL, children}: SessionProviderProps) {
    const [user, setUser] = useState<LoginVO | null>(null);
    const [language, setLanguage] = useState<string>("en");
    const languageKey: string = "language";

    const authAPI = new AuthAPI(baseURL);

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

    // Function to handle login
    const loginUser = (loginRequest: LoginRequest): Promise<LoginStatus> => {
        return authAPI.login(loginRequest)
                .then((jwtResponse) => {
                    localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(jwtResponse));
                    setUser(jwtResponse);
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
        console.log("Logging out so set user data to null and calling authService.logout()");
        authAPI.logout();
    };

    const setSessionLanguage = (language: string) => {
        setLanguage(language);
        localStorage.setItem(languageKey, language);
    };

    const getSessionLanguage = () => {
        return language;
    };

    function refreshUserSession(loginVO: LoginVO): void {
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
