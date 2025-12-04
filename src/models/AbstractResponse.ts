import type {AclVO} from "./Responses";

export interface AbstractResponse {
    id: number;
    acls: AclVO[];
    created: Date;
    creator: number;
    locked: boolean;
    modified: Date;
    modifier: number;
}