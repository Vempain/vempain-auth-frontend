import type {AclVO} from "./AclVO.ts";

export interface AbstractResponse {
    id: number;
    acls: AclVO[];
    locked: boolean;
    creator: number | null;
    modifier: number | null;
    created: string;
    modified: string;
}
