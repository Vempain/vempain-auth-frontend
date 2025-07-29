import type {AclVO} from "./Responses";

export interface AbstractPermissionVO {
    acls: AclVO[];
    created: Date;
    creator: number;
    locked: boolean;
    modified: Date;
    modifier: number;
}