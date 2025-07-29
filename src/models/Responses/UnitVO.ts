// This mirrors the fi.poltsi.vempain.admin.api.response.UnitResponse

import type {AbstractPermissionVO} from "../AbstractPermissionVO";

export interface UnitVO extends AbstractPermissionVO {
    id: number | null;
    name: string;
    description: string;
}
