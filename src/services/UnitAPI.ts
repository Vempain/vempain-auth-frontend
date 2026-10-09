import {AbstractAPI} from "./AbstractAPI";
import type {UnitVO} from "../models";

/**
 * Unit (user group) management of one backend (`<base>/content-management/units`). Memberships travel in `user_ids` and `unit_ids`;
 * the backend answers 400 for a membership that would make a unit contain itself.
 */
export class UnitAPI extends AbstractAPI<UnitVO, UnitVO> {
    /** The backend updates through `PUT /{id}`, unlike the generic `update()` of the base class */
    public async update(payload: UnitVO): Promise<UnitVO> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.put['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.put<UnitVO>("/" + payload.id, payload);
        return response.data;
    }
}
