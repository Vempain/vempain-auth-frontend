import type {ActionResultEnum} from "./ActionResultEnum";

export interface LoginStatus {
    status: ActionResultEnum;
    message: string;
}