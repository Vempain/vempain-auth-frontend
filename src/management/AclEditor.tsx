import type {FormInstance} from "antd";
import type {AclVO, UnitVO, UserVO} from "../models";
import {type AclGranteeOption, ACL_ROW_PRIVILEGES, type AclRowPrivilege, AclRowsEditor} from "./AclRowsEditor";

/** The four privilege switches of an ACL row, in column order; kept as the name the consumers imported before `AclRowsEditor` */
export const ACL_PRIVILEGES = ACL_ROW_PRIVILEGES;
export type AclPrivilege = AclRowPrivilege;

export interface AclEditorProps {
    /** The rows to start from; the editor owns the `acls` Form.List of `parentForm` */
    acls: AclVO[];
    parentForm: FormInstance;
    /** Users offered as grantees */
    users: UserVO[];
    /** Units offered as grantees */
    units: UnitVO[];
    /** Name of the form list, `acls` by default */
    fieldName?: string;
}

/** Users of a backend as grantee options of `AclRowsEditor`: "name (nick)", or the nick alone when the user has no name */
export function userGranteeOptions(users: UserVO[]): AclGranteeOption[] {
    return users.map(user => ({value: user.id, label: user.name ? `${user.name} (${user.nick})` : user.nick}));
}

/** Units of a backend as grantee options of `AclRowsEditor` */
export function unitGranteeOptions(units: UnitVO[]): AclGranteeOption[] {
    return units.map(unit => ({value: unit.id, label: unit.name}));
}

/** A new, unsaved ACL row: no permission or ACL id yet, no grantee chosen, read granted */
export function newAclRow(): AclVO {
    return {permission_id: 0, acl_id: 0, user: null, unit: null, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false};
}

/**
 * The ACL rows of an entity in the persisted `AclVO` shape, used by the user and unit editors of this library and by the content
 * editors of the admin SPA: `AclRowsEditor` on the host form's `acls` list, fed with the backend's own users and units and carrying
 * `permission_id`/`acl_id` of every row along invisibly. The row rules (either a user or a unit, read required, delete requires
 * modify, create implies read, "All" button) are those of `AclRowsEditor`.
 */
export function AclEditor({acls, parentForm, users, units, fieldName = "acls"}: AclEditorProps) {
    return <AclRowsEditor form={parentForm} fieldName={fieldName} initialValue={acls} users={userGranteeOptions(users)} units={unitGranteeOptions(units)}
                          hiddenFields={["permission_id", "acl_id"]} newRow={newAclRow}/>;
}
