import {type AclVO, PrivilegeEnum, type UnitVO} from "../models";

class AclTool {
    public static validateAcl(item: AclVO): boolean {
        if (item.unit === null && item.user === null) {
            return false;
        }

        // This comparison has to use only == so that it compares the enum value only, false == 0, YesNo.YES == 1
        // We also need to use the numeric values in the checkbox true-false definitions
        return !(!item.read_privilege && !item.modify_privilege && !item.create_privilege && !item.delete_privilege);
    }

    public verifyAclList(aclList: AclVO[]): boolean {
        let response: boolean = true;
        const permissionIdList: number[] = [];

        // Check each line for errors
        aclList.forEach((item) => {
            if (!AclTool.validateAcl(item)) {
                response = false;
            }

            if (permissionIdList.includes(item.permission_id)) {
                response = false;
            } else {
                permissionIdList.push(item.permission_id);
            }
        });

        return response;
    }

    public matchAcl(acl1: AclVO, acl2: AclVO) {
        if ((acl1 == null && acl2 != null) || (acl2 == null && acl1 != null)) {
            return false;
        }

        if (acl1 == null && acl2 == null) {
            return true;
        }

        return (
            acl1.acl_id === acl2.acl_id &&
            acl1.permission_id === acl2.permission_id &&
            acl1.create_privilege === acl2.create_privilege &&
            acl1.modify_privilege === acl2.modify_privilege &&
            acl1.read_privilege === acl2.read_privilege &&
            acl1.delete_privilege === acl2.delete_privilege &&
            acl1.user === acl2.user &&
            acl1.unit === acl2.unit
        );
    }

    public matchUnit(unit1: UnitVO, unit2: UnitVO) {
        if ((unit1 === null && unit2 !== null) || (unit2 === null && unit1 !== null)) {
            return false;
        }

        if (unit1 === null && unit2 === null) {
            return true;
        }

        return (
            unit1.id === unit2.id &&
            unit1.acls === unit2.acls &&
            unit1.creator === unit2.creator &&
            unit1.created === unit2.created &&
            unit1.modifier === unit2.modifier &&
            unit1.modified === unit2.modified &&
            unit1.description === unit2.description &&
            unit1.name === unit2.name
        );
    }

    public completeAcl(acl: AclVO): AclVO {
        console.log("completeAcl", acl);

        if (acl.permission_id === null || acl.permission_id === undefined) {
            console.debug("Completing permission_id");
            acl.permission_id = 0;
        }

        if (acl.acl_id === null || acl.acl_id === undefined) {
            console.debug("Completing acl_id");
            acl.acl_id = 0;
        }

        return acl;
    }

    public hasPrivilege(privilege: PrivilegeEnum, userId: number | undefined, units: UnitVO[] | undefined, acls: AclVO[]): boolean {
        if (userId === undefined && units === undefined) {
            console.warn("No user or unit provided to check privileges");
            return false;
        }

        for (const acl of acls) {
            let hasPrivilege: boolean = false;

            switch (privilege) {
                case PrivilegeEnum.CREATE:
                    hasPrivilege = acl.create_privilege;
                    break;
                case PrivilegeEnum.READ:
                    hasPrivilege = acl.read_privilege;
                    break;
                case PrivilegeEnum.MODIFY:
                    hasPrivilege = acl.modify_privilege;
                    break;
                case PrivilegeEnum.DELETE:
                    hasPrivilege = acl.delete_privilege;
                    break;
            }

            // If the user has permission, then we go no further
            if (userId !== undefined && acl.user === userId && hasPrivilege) {
                return true;
            }

            if (acl.unit !== undefined && acl.unit !== null && hasPrivilege) {
                // Find the aclUnit in the given list of units
                const unit = units?.find((unit) => unit.id === acl.unit);

                if (unit !== undefined) {
                    return true;
                }
            }
        }

        return false;
    }

    public fillPermission(acl: AclVO): void {
        if (acl.permission_id === undefined || acl.permission_id === null) {
            acl.permission_id = 0;
        }

        if (acl.unit === undefined) {
            acl.unit = null;
        }

        if (acl.user === undefined) {
            acl.user = null;
        }

        if (acl.acl_id === undefined || acl.acl_id === null) {
            acl.acl_id = 0;
        }

        if (acl.create_privilege === undefined) {
            acl.create_privilege = false;
        }

        if (acl.read_privilege === undefined) {
            acl.read_privilege = false;
        }

        if (acl.modify_privilege === undefined) {
            acl.modify_privilege = false;
        }

        if (acl.delete_privilege === undefined) {
            acl.delete_privilege = false;
        }
    }
}

export const aclTool = new AclTool();
