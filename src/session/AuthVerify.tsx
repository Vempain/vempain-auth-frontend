import {useLocation} from "react-router-dom";
import {useEffect} from "react";
import type {LoginResponse} from "../models";
import {isSessionExpired} from "./sessionExpiration";
import {readStoredSessionText} from "./sessionStore";

interface AuthVerifyProps {
    logOut: () => void;
}

export function AuthVerify({logOut}: AuthVerifyProps) {
    const location = useLocation();

    useEffect(() => {
        const userData = readStoredSessionText();
        if (!userData) {
            return;
        }

        try {
            const session = JSON.parse(userData) as LoginResponse;
            if (isSessionExpired(session)) {
                logOut();
            }
        } catch {
            logOut();
        }
    }, [location, logOut]);

    return (<></>);
}
