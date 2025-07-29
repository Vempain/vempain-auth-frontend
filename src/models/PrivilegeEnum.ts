export const PrivilegeEnum = {
    CREATE: 'CREATE',
    READ: 'READ',
    MODIFY: 'MODIFY',
    DELETE: 'DELETE'
} as const;

export type PrivilegeEnum = (typeof PrivilegeEnum)[keyof typeof PrivilegeEnum];