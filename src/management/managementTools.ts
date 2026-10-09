import type {AclVO, UnitVO, UserVO} from "../models";
import type {UnitAPI} from "../services/UnitAPI";
import type {UserAPI} from "../services/UserAPI";
import {aclTool} from "../tools/AclTool";

/** Page size used when the editors load every user and unit for the selects */
export const MANAGEMENT_LOOKUP_PAGE_SIZE = 500;

/** Loads every user and unit of the backend (first lookup page, sorted by name) for the member and ACL selects */
export async function loadUsersAndUnits(userAPI: UserAPI, unitAPI: UnitAPI): Promise<{ users: UserVO[]; units: UnitVO[] }> {
    const [users, units] = await Promise.all([
        userAPI.findPageable({page: 0, size: MANAGEMENT_LOOKUP_PAGE_SIZE, sort_by: "name", direction: "ASC"}),
        unitAPI.findPageable({page: 0, size: MANAGEMENT_LOOKUP_PAGE_SIZE, sort_by: "name", direction: "ASC"})
    ]);
    return {users: users.content ?? [], units: units.content ?? []};
}

/** An ACL row granting one user every privilege, the default of a new entity */
export function fullAclFor(userId: number): AclVO {
    return {
        permission_id: 0, acl_id: 0, user: userId, unit: null,
        create_privilege: true, read_privilege: true, modify_privilege: true, delete_privilege: true
    };
}

/** Normalises the rows of the ACL editor before they are sent */
export function completeAcls(acls: AclVO[] | undefined | null): AclVO[] {
    return (acls ?? []).map(acl => aclTool.completeAcl({
        ...acl,
        user: acl.user === undefined || (acl.user as unknown) === "" ? null : acl.user,
        unit: acl.unit === undefined || (acl.unit as unknown) === "" ? null : acl.unit
    }));
}
