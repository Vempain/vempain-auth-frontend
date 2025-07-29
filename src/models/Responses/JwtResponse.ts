// This is used to log on the user to the application

import type {UnitVO} from "./UnitVO";

export interface JwtResponse {
    id: number;
    login: string;
    nickname: string;
    email: string;
    password: string;
    units: UnitVO[];
    token: string;
    type: string;
}
