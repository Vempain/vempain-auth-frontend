export interface PagedResponse<T> {
    content: T[];
    page: number;
    size: number;
    total_elements: number;
    total_pages: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}