import {useLocation} from "react-router-dom";
import {useEffect} from "react";
import {type LoginResponse, VEMPAIN_LOCAL_STORAGE_KEY} from "../models";
import {isSessionExpired} from "./sessionExpiration";

interface AuthVerifyProps {
    logOut: () => void;
}

export function AuthVerify({logOut}: AuthVerifyProps) {
    const location = useLocation();

    useEffect(() => {
        const userData = localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY);
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
