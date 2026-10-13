import {jest} from "@jest/globals";
import type {AclVO, UnitVO} from "../models";
import {PrivilegeEnum} from "../models";
import {aclTool} from "../tools/AclTool";

function acl(overrides: Partial<AclVO> = {}): AclVO {
    return {
        permission_id: 1,
        acl_id: 10,
        user: 7,
        unit: null,
        create_privilege: false,
        read_privilege: true,
        modify_privilege: false,
        delete_privilege: false,
        ...overrides
    };
}

function unit(overrides: Partial<UnitVO> = {}): UnitVO {
    return {
        id: 3,
        name: "unit",
        description: "",
        acls: [],
        user_ids: [],
        unit_ids: [],
        locked: false,
        creator: 1,
        created: null as never,
        modifier: null,
        modified: null,
        ...overrides
    };
}

describe("aclTool", () => {
    let consoleSpies: Array<ReturnType<typeof jest.spyOn>>;

    beforeEach(() => {
        consoleSpies = [
            jest.spyOn(console, "log").mockImplementation(() => undefined),
            jest.spyOn(console, "debug").mockImplementation(() => undefined),
            jest.spyOn(console, "warn").mockImplementation(() => undefined)
        ];
    });

    afterEach(() => {
        consoleSpies.forEach(spy => spy.mockRestore());
    });

    describe("verifyAclList", () => {
        it("accepts rows that name a grantee, grant something and have unique permission ids", () => {
            expect(aclTool.verifyAclList([acl({permission_id: 1}), acl({permission_id: 2, user: null, unit: 3})])).toBe(true);
        });

        it("rejects a row without user and unit", () => {
            expect(aclTool.verifyAclList([acl({user: null, unit: null})])).toBe(false);
        });

        it("rejects a row without any privilege", () => {
            expect(aclTool.verifyAclList([acl({read_privilege: false})])).toBe(false);
        });

        it("rejects duplicate permission ids", () => {
            expect(aclTool.verifyAclList([acl({permission_id: 5}), acl({permission_id: 5})])).toBe(false);
        });
    });

    describe("matchAcl", () => {
        it("treats two missing rows as equal and a single missing row as different", () => {
            expect(aclTool.matchAcl(null as never, null as never)).toBe(true);
            expect(aclTool.matchAcl(null as never, acl())).toBe(false);
            expect(aclTool.matchAcl(acl(), null as never)).toBe(false);
        });

        it("compares every field of the rows", () => {
            expect(aclTool.matchAcl(acl(), acl())).toBe(true);
            expect(aclTool.matchAcl(acl(), acl({modify_privilege: true}))).toBe(false);
            expect(aclTool.matchAcl(acl(), acl({unit: 3}))).toBe(false);
        });
    });

    describe("matchUnit", () => {
        it("treats two missing units as equal and a single missing unit as different", () => {
            expect(aclTool.matchUnit(null as never, null as never)).toBe(true);
            expect(aclTool.matchUnit(null as never, unit())).toBe(false);
            expect(aclTool.matchUnit(unit(), null as never)).toBe(false);
        });

        it("compares the identifying fields of the units", () => {
            const acls: AclVO[] = [];
            expect(aclTool.matchUnit(unit({acls}), unit({acls}))).toBe(true);
            expect(aclTool.matchUnit(unit({acls}), unit({acls, name: "other"}))).toBe(false);
        });
    });

    describe("completeAcl and fillPermission", () => {
        it("defaults missing ids to 0 and keeps given ones", () => {
            const completed = aclTool.completeAcl({...acl(), permission_id: undefined as never, acl_id: null as never});
            expect(completed.permission_id).toBe(0);
            expect(completed.acl_id).toBe(0);

            const untouched = aclTool.completeAcl(acl({permission_id: 4, acl_id: 8}));
            expect(untouched.permission_id).toBe(4);
            expect(untouched.acl_id).toBe(8);
        });

        it("fills every missing field of a row", () => {
            const row = {} as AclVO;
            aclTool.fillPermission(row);
            expect(row).toEqual({
                permission_id: 0,
                acl_id: 0,
                user: null,
                unit: null,
                create_privilege: false,
                read_privilege: false,
                modify_privilege: false,
                delete_privilege: false
            });
        });

        it("leaves given fields of a row alone", () => {
            const row = acl({permission_id: 2, acl_id: 3, unit: 4, create_privilege: true, modify_privilege: true, delete_privilege: true});
            aclTool.fillPermission(row);
            expect(row).toEqual(acl({permission_id: 2, acl_id: 3, unit: 4, create_privilege: true, modify_privilege: true, delete_privilege: true}));
        });
    });

    describe("hasPrivilege", () => {
        const acls = [
            acl({user: 7, read_privilege: true, modify_privilege: true}),
            acl({user: null, unit: 3, create_privilege: true, delete_privilege: true}),
            acl({user: null, unit: 9, read_privilege: true})
        ];

        it("refuses without a user and without units", () => {
            expect(aclTool.hasPrivilege(PrivilegeEnum.READ, undefined, undefined, acls)).toBe(false);
            expect(console.warn).toHaveBeenCalledTimes(1);
        });

        it("grants through a user row", () => {
            expect(aclTool.hasPrivilege(PrivilegeEnum.READ, 7, [], acls)).toBe(true);
            expect(aclTool.hasPrivilege(PrivilegeEnum.MODIFY, 7, undefined, acls)).toBe(true);
            expect(aclTool.hasPrivilege(PrivilegeEnum.DELETE, 7, [], acls)).toBe(false);
        });

        it("grants through a unit row only when the user belongs to the unit", () => {
            expect(aclTool.hasPrivilege(PrivilegeEnum.CREATE, 8, [unit({id: 3})], acls)).toBe(true);
            expect(aclTool.hasPrivilege(PrivilegeEnum.DELETE, undefined, [unit({id: 3})], acls)).toBe(true);
            expect(aclTool.hasPrivilege(PrivilegeEnum.CREATE, 8, [unit({id: 5})], acls)).toBe(false);
            expect(aclTool.hasPrivilege(PrivilegeEnum.MODIFY, 8, [unit({id: 3})], acls)).toBe(false);
        });
    });
});
