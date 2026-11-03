/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import type {AclBulkUpdateRequest, AclBulkUpdateResponse, AclVO, PagedResponse, UnitVO, UserVO} from "../models";
import {AclBulkEditor, AclBulkUpdateButton, toBulkEntries} from "../management/AclBulkEditor";
import type {AclAPI} from "../services/AclAPI";
import type {UnitAPI} from "../services/UnitAPI";
import type {UserAPI} from "../services/UserAPI";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
            let value = options?.defaultValue ?? _key;
            for (const [name, replacement] of Object.entries(options ?? {})) {
                value = value.replace(`{{${name}}}`, String(replacement));
            }
            return value;
        }
    })
}));
jest.mock("@ant-design/icons", () => ({
    MinusCircleFilled: () => null,
    PlusCircleFilled: () => null
}));

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
        matches: false,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
    })
});
if (typeof globalThis.MessageChannel === "undefined") {
    class StubMessageChannel {
        port1: { onmessage: ((event: { data: unknown }) => void) | null; postMessage: (data: unknown) => void };
        port2: { onmessage: ((event: { data: unknown }) => void) | null; postMessage: (data: unknown) => void };

        constructor() {
            this.port1 = {onmessage: null, postMessage: data => setTimeout(() => this.port2.onmessage?.({data}), 0)};
            this.port2 = {onmessage: null, postMessage: data => setTimeout(() => this.port1.onmessage?.({data}), 0)};
        }
    }

    Object.defineProperty(globalThis, "MessageChannel", {writable: true, value: StubMessageChannel});
}

const users = [{id: 7, name: "Seven", nick: "seven", login_name: "seven"}] as UserVO[];
const units = [{id: 3, name: "Unit three"}] as UnitVO[];

function page<T>(content: T[]): PagedResponse<T> {
    return {content, total_elements: content.length, total_pages: 1, page: 0, size: content.length} as unknown as PagedResponse<T>;
}

function row(overrides: Partial<AclVO> = {}): AclVO {
    return {permission_id: 0, acl_id: 0, user: 7, unit: null, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false, ...overrides};
}

function apis() {
    const bulkUpdate = jest.fn<(request: AclBulkUpdateRequest) => Promise<AclBulkUpdateResponse>>();
    const userAPI = {findPageable: jest.fn<() => Promise<PagedResponse<UserVO>>>().mockResolvedValue(page(users))} as unknown as UserAPI;
    const unitAPI = {findPageable: jest.fn<() => Promise<PagedResponse<UnitVO>>>().mockResolvedValue(page(units))} as unknown as UnitAPI;
    return {bulkUpdate, aclAPI: {bulkUpdate} as unknown as AclAPI, userAPI, unitAPI};
}

describe("AclBulkEditor", () => {
    it("sends the rows as entries with the chosen mode to every selected ACL and reports the outcome", async () => {
        const {bulkUpdate, aclAPI, userAPI, unitAPI} = apis();
        const response: AclBulkUpdateResponse = {updated_acl_ids: [41], skipped_acl_ids: [42]};
        bulkUpdate.mockResolvedValue(response);
        const onUpdated = jest.fn();
        render(<AclBulkEditor open aclIds={[41, 42]} aclAPI={aclAPI} userAPI={userAPI} unitAPI={unitAPI} onCancel={jest.fn()} onUpdated={onUpdated}
                              initialRows={[row({modify_privilege: true}), row({user: null, unit: 3})]}/>);

        expect(await screen.findByText("Permissions of the selected resources (2)")).toBeTruthy();
        await waitFor(() => expect(userAPI.findPageable).toHaveBeenCalled());
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(2));
        fireEvent.click(screen.getByLabelText("Replace with these"));
        expect(screen.getByText("Every existing row of the selected resources is removed first.")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", {name: "Apply"}));

        await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(response));
        expect(bulkUpdate).toHaveBeenCalledWith({
            acl_ids: [41, 42],
            mode: "REPLACE",
            entries: [
                {user: 7, unit: null, create_privilege: false, read_privilege: true, modify_privilege: true, delete_privilege: false},
                {user: null, unit: 3, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false}
            ]
        });
    });

    it("refuses an invalid row and shows the error of a rejected update", async () => {
        const {bulkUpdate, aclAPI, userAPI, unitAPI} = apis();
        bulkUpdate.mockRejectedValue(new Error("400"));
        const onUpdated = jest.fn();
        const {unmount} = render(<AclBulkEditor open aclIds={[41]} aclAPI={aclAPI} userAPI={userAPI} unitAPI={unitAPI} onCancel={jest.fn()}
                                                onUpdated={onUpdated} initialRows={[row({user: null})]}/>);
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));

        fireEvent.click(screen.getByRole("button", {name: "Apply"}));

        await screen.findAllByText("Either a user or a unit must be selected.");
        expect(bulkUpdate).not.toHaveBeenCalled();
        unmount();

        render(<AclBulkEditor open aclIds={[41]} aclAPI={aclAPI} userAPI={userAPI} unitAPI={unitAPI} onCancel={jest.fn()} onUpdated={onUpdated}
                              initialRows={[row()]}/>);
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));
        fireEvent.click(screen.getByRole("button", {name: "Apply"}));

        await screen.findByText("Failed to update the permissions");
        expect(onUpdated).not.toHaveBeenCalled();
    });

    it("the button is disabled without a selection, opens the dialog and closes it after the update", async () => {
        const {bulkUpdate, aclAPI, userAPI, unitAPI} = apis();
        bulkUpdate.mockResolvedValue({updated_acl_ids: [41], skipped_acl_ids: []});
        const onUpdated = jest.fn();
        const {rerender} = render(<AclBulkUpdateButton aclIds={[]} aclAPI={aclAPI} userAPI={userAPI} unitAPI={unitAPI} onUpdated={onUpdated}/>);
        const button = screen.getByRole("button", {name: "Permissions of selected (0)"});
        expect(button.hasAttribute("disabled")).toBe(true);
        expect(screen.queryByText("Apply")).toBeNull();

        rerender(<AclBulkUpdateButton aclIds={[41]} aclAPI={aclAPI} userAPI={userAPI} unitAPI={unitAPI} onUpdated={onUpdated} initialRows={[row()]}/>);
        fireEvent.click(screen.getByRole("button", {name: "Permissions of selected (1)"}));
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));
        fireEvent.click(screen.getByRole("button", {name: "Apply"}));

        await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("button", {name: "Apply"})).toBeNull());
    });

    it("toBulkEntries keeps only the grantee and privilege fields", () => {
        expect(toBulkEntries([row({permission_id: 9, acl_id: 41, delete_privilege: true, modify_privilege: true})])).toEqual([
            {user: 7, unit: null, create_privilege: false, read_privilege: true, modify_privilege: true, delete_privilege: true}
        ]);
        expect(toBulkEntries(undefined)).toEqual([]);
    });
});
