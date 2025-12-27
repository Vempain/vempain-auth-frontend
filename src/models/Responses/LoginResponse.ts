// This is used to log on the user to the application

import type {UnitVO} from "./UnitVO";
import type {Dayjs} from "dayjs";

export interface LoginResponse {
    token: string;
    id: number;
    login: string;
    nickname: string;
    email: string;
    units: UnitVO[];
    expires_at: Dayjs;
}
