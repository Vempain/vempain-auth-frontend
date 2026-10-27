import Axios, {type AxiosInstance} from "axios";
import type {LoginRequest, LoginResponse} from "../models";
import {clearStoredSession, writeStoredSession} from "../session/sessionStore";

export class AuthAPI {
    member: string = "/login";

    protected axiosInstance: AxiosInstance;

    constructor(baseURL: string) {
        this.axiosInstance = Axios.create({
            baseURL: baseURL + this.member
        });
    }

    /**
     * Logs in and persists the session where `remember` says: in local storage (across browser restarts, the default) or, when the user
     * did not tick "Remember me", in session storage for this browser window only. Only the credentials are sent to the backend.
     */
    async login(user: LoginRequest, remember: boolean = true): Promise<LoginResponse> {
        const response = await this.axiosInstance.post<LoginResponse>("", user);

        if (response.status === 200 && response.data.id > 0) {
            const session: LoginResponse = response.data;

            writeStoredSession(session, remember);
        } else {
            if (response.status !== 200) {
                console.error("The response status was " + response.status + ": " + JSON.stringify(response));
            } else {
                console.error("The response did not contain data.token: " + JSON.stringify(response));
            }
        }

        return response.data;
    }

    logout() {
        clearStoredSession();
    }
}
