import {AbstractAPI} from "./AbstractAPI";
import type {UserVO} from "../models";

/**
 * User account management of one backend (`<base>/content-management/users`). The admin and file backends keep separate user bases, so
 * every SPA instantiates this against its own backend URL.
 */
export class UserAPI extends AbstractAPI<UserVO, UserVO> {
    /** The backend updates through `PUT /{id}`, unlike the generic `update()` of the base class */
    public async update(payload: UserVO): Promise<UserVO> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.put['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.put<UserVO>("/" + payload.id, payload);
        return response.data;
    }
}
