// This is used to log on the user to the application

import type {UnitVO} from "./Responses";

export class LoginVO {
    id: number;
    login: string;
    nickname: string;
    email: string;
    password: string;
    units: UnitVO[];
    token: string;
    type: string;

    constructor(id: number, login: string, nickname: string, email: string, password: string, token: string, type: string) {
        this.id = id;
        this.login = login;
        this.nickname = nickname;
        this.email = email;
        this.password = password;
        this.units = [];
        this.token = token;
        this.type = type;
    }
}
