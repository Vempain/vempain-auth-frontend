export const SortDirectionEnum = {
    ASC: 'ASC',
    DESC: 'DESC'
} as const;

export type SortDirectionEnum = (typeof SortDirectionEnum)[keyof typeof SortDirectionEnum];