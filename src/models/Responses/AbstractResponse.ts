import type {AclVO} from "./AclVO.ts";
import type {Dayjs} from "dayjs";

export interface AbstractResponse {
    id: number;
    acls: AclVO[];
    locked: boolean;
    creator: number;
    created: Dayjs;
    modifier: number | null;
    modified: Dayjs | null;
}
