import {useSession} from "../session";
import {type NavigateFunction, useNavigate} from "react-router-dom";
import {useEffect} from "react";

function Logout() {
    const {logoutUser} = useSession();
    const navigate: NavigateFunction = useNavigate();

    useEffect(() => {
        console.log("Logout useEffect");
        logoutUser();
        navigate("/");
    }, [logoutUser, navigate]);

    return (
            <></>
    );
}

export {Logout};