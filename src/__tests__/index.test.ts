/**
 * @jest-environment jsdom
 */

import {jest} from "@jest/globals";
import * as library from "../index";
import * as main from "../main";
import * as management from "../management";
import * as models from "../models";
import * as services from "../services";
import * as session from "../session";
import * as tools from "../tools";

// The icon package ships ESM only; the component tests stub the icons the library uses
jest.mock("@ant-design/icons", () => ({
    EditOutlined: () => null,
    MinusCircleFilled: () => null,
    PlusCircleFilled: () => null,
    SearchOutlined: () => null
}));

/** Reads every export once so that each barrel binding is exercised, and returns the exported names */
function exportedNames(module: Record<string, unknown>): string[] {
    const names: string[] = [];
    for (const name of Object.keys(module)) {
        void module[name];
        names.push(name);
    }
    return names.sort();
}

describe("library entry point", () => {
    it("re-exports the main components and table helpers", () => {
        expect(exportedNames(main)).toEqual(expect.arrayContaining([
            "Login", "Logout", "VempainTable", "CLIENT_FETCH_MAX_PAGES", "CLIENT_PAGE_SIZE", "applyColumnFilters", "compareCellValues",
            "fetchAllPages", "isActionColumn", "isNarrowScreen", "matchesFilterValue", "matchesSearchText", "reduceToSingleFilter",
            "renderCollapsedValue", "splitColumnsForMobile", "PAGED_TABLE_PAGE_SIZE_OPTIONS", "sorterFieldName", "toPagedRequest", "usePagedTable"
        ]));
        expect(main.CLIENT_PAGE_SIZE).toBe(100);
        expect(main.CLIENT_FETCH_MAX_PAGES).toBe(50);
        expect(main.PAGED_TABLE_PAGE_SIZE_OPTIONS).toEqual(["5", "10", "25", "50", "100"]);
    });

    it("re-exports the management screens and helpers", () => {
        expect(exportedNames(management)).toEqual(expect.arrayContaining([
            "AclRowsEditor", "ACL_ROW_PRIVILEGES", "ACL_ROW_TRANSLATION_DEFAULTS", "defaultAclRow", "AclEditor", "ACL_PRIVILEGES",
            "userGranteeOptions", "unitGranteeOptions", "newAclRow", "UserList", "UserEditor", "AuditLine", "PRIVACY_TYPES", "UnitList", "UnitEditor",
            "loadUsersAndUnits", "fullAclFor", "completeAcls", "MANAGEMENT_LOOKUP_PAGE_SIZE"
        ]));
        expect(management.PRIVACY_TYPES).toEqual(["PRIVATE", "GROUP", "PUBLIC"]);
        expect(management.MANAGEMENT_LOOKUP_PAGE_SIZE).toBe(500);
    });

    it("re-exports the models as const objects and the storage key", () => {
        expect(exportedNames(models)).toEqual(expect.arrayContaining([
            "ActionResult", "ActionResultEnum", "PrivilegeEnum", "SortDirectionEnum", "VEMPAIN_LOCAL_STORAGE_KEY"
        ]));
        expect(models.VEMPAIN_LOCAL_STORAGE_KEY).toBe("vempainUser");
        expect(models.ActionResult).toEqual({OK: "OK", FAIL: "FAIL", NO_CHANGE: "NO_CHANGE"});
        expect(models.ActionResultEnum).toEqual({SUCCESS: "SUCCESS", FAILURE: "FAILURE"});
        expect(models.PrivilegeEnum).toEqual({CREATE: "CREATE", READ: "READ", MODIFY: "MODIFY", DELETE: "DELETE"});
        expect(models.SortDirectionEnum).toEqual({ASC: "ASC", DESC: "DESC"});
    });

    it("re-exports the API clients and the interceptor functions", () => {
        expect(exportedNames(services)).toEqual([
            "AbstractAPI", "AclAPI", "AuthAPI", "UnitAPI", "UserAPI", "clearOnUnauthorizedCallback", "removeAuthInterceptor",
            "resetUnauthorizedHandling", "setLoginPath", "setOnUnauthorizedCallback", "setupAuthInterceptor"
        ]);
        expect(typeof services.AuthAPI).toBe("function");
        expect(typeof services.setupAuthInterceptor).toBe("function");
    });

    it("re-exports the session provider, hook and verifier", () => {
        expect(exportedNames(session)).toEqual(["AuthVerify", "SessionProvider", "isSessionExpired", "useSession"]);
    });

    it("re-exports the tools", () => {
        expect(exportedNames(tools)).toEqual([
            "TRACEPARENT_PATTERN", "UserName", "aclTool", "clearUserNameCache", "collectDescendantUnitIds", "createTraceContext",
            "currentTraceId", "nextTraceparent", "randomHexId", "resolveUserName", "selectableMemberUnits", "validateParamId",
            "wouldCreateUnitCycle"
        ]);
        expect(tools.validateParamId("42")).toBe(42);
    });

    it("exposes every module export from the root index", () => {
        const root = exportedNames(library);
        for (const module of [main, management, models, services, session, tools]) {
            for (const name of exportedNames(module)) {
                expect(root).toContain(name);
                expect((library as Record<string, unknown>)[name]).toBe((module as Record<string, unknown>)[name]);
            }
        }
    });
});
