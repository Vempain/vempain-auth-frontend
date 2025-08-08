import type {ReactNode} from "react";
import {createContext, useContext, useEffect, useState} from "react";
import type {LoginStatus, LoginVO} from "../models";
import {ActionResultEnum} from "../models";
import type {LoginRequest} from "../models/Requests";
import {AuthAPI} from "../services";

// Define the type for the session context
interface SessionContextType {
    userSession: LoginVO | null;
    loginUser: (loginRequest: LoginRequest) => Promise<LoginStatus>;
    logoutUser: () => void;
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
    const userKey: string = "vempainUser";
    const authAPI = new AuthAPI(baseURL);

    // Check if user data exists in local storage on initial load
    useEffect(() => {
        const userData = localStorage.getItem(userKey);

        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, [userKey]);

    // Function to handle login
    const loginUser = (loginRequest: LoginRequest): Promise<LoginStatus> => {
        return authAPI.login(loginRequest)
                .then((jwtResponse) => {
                    localStorage.setItem(userKey, JSON.stringify(jwtResponse));
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

    const contextValue: SessionContextType = {
        userSession: user,
        loginUser,
        logoutUser
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
