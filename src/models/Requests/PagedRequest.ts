import type {SortDirectionEnum} from "../SortDirectionEnum.ts";

export interface PagedRequest {
    page: number;
    size: number;
    sort_by?: string;
    direction?: SortDirectionEnum;
    search?: string;
    case_sensitive?: boolean;
}