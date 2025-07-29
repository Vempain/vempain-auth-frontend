export interface AclVO {
    permission_id: number;
    acl_id: number;
    user: number | null;
    unit: number | null;
    create_privilege: boolean;
    read_privilege: boolean;
    modify_privilege: boolean;
    delete_privilege: boolean;
}
