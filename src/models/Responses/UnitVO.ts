// This mirrors the fi.poltsi.vempain.auth.api.response.UnitResponse

import type {AbstractResponse} from "./AbstractResponse.ts";

export interface UnitVO extends AbstractResponse {
    name: string;
    description: string;
    /** IDs of the users that are direct members of the unit */
    user_ids: number[];
    /** IDs of the units that are direct members (sub-units) of the unit; units nest, but never circularly */
    unit_ids: number[];
}
