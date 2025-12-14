// This mirrors the fi.poltsi.vempain.admin.api.response.UnitResponse

import type {AbstractResponse} from "./AbstractResponse.ts";

export interface UnitVO extends AbstractResponse {
    name: string;
    description: string;
}
