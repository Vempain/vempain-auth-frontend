// This mirrors the fi.poltsi.vempain.admin.api.response.UserResponse

import type {AbstractPermissionVO} from "../AbstractPermissionVO";

export interface UserVO extends AbstractPermissionVO {
    id: number;
    private_user: boolean;
    name: string;
    nick: string;
    login_name: string;
    privacy_type: string;
    email: string;
    street: string;
    pob: string;
    birthday: Date;
    description: string;
    password: string;
}
