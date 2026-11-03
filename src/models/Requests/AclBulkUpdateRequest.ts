/** How the bulk update treats the rows an ACL already has: `ADD` merges the entries in, `REPLACE` removes every existing row first */
export const AclBulkUpdateModeEnum = {
    ADD: "ADD",
    REPLACE: "REPLACE"
} as const;

export type AclBulkUpdateMode = typeof AclBulkUpdateModeEnum[keyof typeof AclBulkUpdateModeEnum];

/** One grantee of a bulk update: a user or a unit with the privileges to grant on every selected ACL */
export interface AclBulkEntry {
    user: number | null;
    unit: number | null;
    create_privilege: boolean;
    read_privilege: boolean;
    modify_privilege: boolean;
    delete_privilege: boolean;
}

/** `POST /content-management/acls/bulk`: the same entries applied to the ACLs of several selected resources */
export interface AclBulkUpdateRequest {
    acl_ids: number[];
    mode: AclBulkUpdateMode;
    entries: AclBulkEntry[];
}
