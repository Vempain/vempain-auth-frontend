/** The outcome of a bulk ACL update: the ACLs changed and those left alone (unknown, or the caller holds no modify privilege on them) */
export interface AclBulkUpdateResponse {
    updated_acl_ids: number[];
    skipped_acl_ids: number[];
}
