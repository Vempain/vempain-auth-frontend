import Axios, {type AxiosInstance} from "axios";
import {type LoginRequest, type LoginResponse, VEMPAIN_LOCAL_STORAGE_KEY} from "../models";

export class AuthAPI {
    member: string = "/login";

    protected axiosInstance: AxiosInstance;

    constructor(baseURL: string) {
        this.axiosInstance = Axios.create({
            baseURL: baseURL + this.member
        });
    }

    async login(user: LoginRequest): Promise<LoginResponse> {
        const response = await this.axiosInstance.post<LoginResponse>("", user);

        if (response.status === 200 && response.data.id > 0) {
            const session: LoginResponse = response.data;

            localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(session));
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
        console.log('Logout so clearing out local storage');
        localStorage.removeItem(VEMPAIN_LOCAL_STORAGE_KEY);
        console.info("Removed user key from local storage");
    }
}
