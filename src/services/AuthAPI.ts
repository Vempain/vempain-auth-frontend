import Axios, {type AxiosInstance} from "axios";
import type {LoginRequest} from "../models/Requests";
import type {JwtResponse} from "../models/Responses";

export class AuthAPI {
    userKey: string = 'vempainUser';
    member: string = "/login";

    protected axiosInstance: AxiosInstance;

    constructor(baseURL: string) {
        this.axiosInstance = Axios.create({
            baseURL: baseURL + this.member
        });
    }

    async login(user: LoginRequest): Promise<JwtResponse> {
        const response = await this.axiosInstance.post<JwtResponse>("", user);

        if (response.status === 200 && response.data.id > 0) {
            const session: JwtResponse = response.data;

            localStorage.setItem(this.userKey, JSON.stringify(session));
            console.log('After login post, set user session in local storage:', session);
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
        localStorage.removeItem(this.userKey);
        console.info("Removed user key from local storage");
    }
}
