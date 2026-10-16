/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Form} from "antd";
import {jest} from "@jest/globals";
import {ACL_ROW_PRIVILEGES, ACL_ROW_TRANSLATION_DEFAULTS, AclRowsEditor, type AclRowsEditorProps, defaultAclRow} from "../management/AclRowsEditor";

jest.mock("react-i18next", () => ({
    // Echo the key so that assertions do not depend on the English defaults
    useTranslation: () => ({t: (key: string) => key})
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
// antd's Form field scheduler needs MessageChannel and the Select dropdown a ResizeObserver, which jsdom lacks
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
if (typeof globalThis.ResizeObserver === "undefined") {
    class StubResizeObserver {
        observe() {
        }

        unobserve() {
        }

        disconnect() {
        }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {writable: true, value: StubResizeObserver});
}

const users = [{value: 12, label: "Arnold (arnold)"}, {value: 13, label: "Bea (bea)"}];
const units = [{value: 3, label: "Editors"}];

type HostProps = Omit<AclRowsEditorProps, "form"> & { onFinish?: jest.Mock; initialValues?: Record<string, unknown> };

function Host({onFinish = jest.fn(), initialValues, ...editorProps}: HostProps) {
    const [form] = Form.useForm();
    return (
            <Form form={form} onFinish={onFinish} initialValues={initialValues}>
                <AclRowsEditor form={form} {...editorProps}/>
                <button type="submit">submit</button>
            </Form>
    );
}

function switches(): HTMLElement[] {
    return screen.getAllByRole("switch");
}

function checked(element: HTMLElement): boolean {
    return element.getAttribute("aria-checked") === "true";
}

async function submitAndExpect(onFinish: jest.Mock, calls: number) {
    fireEvent.click(screen.getByText("submit"));
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(calls));
}

type Submitted = { acls: Array<{ user?: number | null; unit?: number | null }>; grants: unknown[] };

function submitted(onFinish: jest.Mock): Submitted {
    return onFinish.mock.calls[0][0] as Submitted;
}

describe("AclRowsEditor", () => {
    it("exports the privilege order, the translation defaults and a read-only default row", () => {
        expect(ACL_ROW_PRIVILEGES).toEqual(["create_privilege", "read_privilege", "modify_privilege", "delete_privilege"]);
        expect(ACL_ROW_TRANSLATION_DEFAULTS["AclRow.actions.add"]).toBe("Add ACL");
        expect(defaultAclRow()).toEqual({user: null, unit: null, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false});
        expect(defaultAclRow("user_id", "unit_id")).toEqual({
            user_id: null, unit_id: null, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false
        });
    });

    it("adds a row with read granted, grants everything with All and removes the row again", async () => {
        const onFinish = jest.fn();
        render(<Host users={users} units={units} onFinish={onFinish}/>);

        expect(screen.getByTestId("acl-row-header").textContent).toContain("AclRow.columns.unit");
        fireEvent.click(screen.getByText("AclRow.actions.add"));
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));
        expect(switches().map(checked)).toEqual([false, true, false, false]);
        expect(screen.getAllByRole("combobox")).toHaveLength(2);

        fireEvent.click(screen.getByLabelText("AclRow.actions.grantAll"));
        await waitFor(() => expect(switches().map(checked)).toEqual([true, true, true, true]));

        // Without a grantee the row does not validate
        fireEvent.click(screen.getByText("submit"));
        await waitFor(() => expect(screen.getAllByText("AclRow.validation.userOrUnit").length).toBeGreaterThan(0));
        expect(onFinish).not.toHaveBeenCalled();

        fireEvent.click(screen.getByLabelText("AclRow.actions.remove"));
        await waitFor(() => expect(screen.queryAllByTestId("acl-row")).toHaveLength(0));
        await submitAndExpect(onFinish, 1);
        expect(submitted(onFinish).acls).toEqual([]);
    });

    it("rejects a user and a unit on the same row and submits a unit-only row", async () => {
        const onFinish = jest.fn();
        render(<Host users={users} units={units} onFinish={onFinish}
                     initialValues={{acls: [{user: 12, unit: 3, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false}]}}/>);
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));

        fireEvent.click(screen.getByText("submit"));
        await waitFor(() => expect(screen.getAllByText("AclRow.validation.notBoth").length).toBeGreaterThan(0));
        expect(onFinish).not.toHaveBeenCalled();
    });

    it("submits a unit-only row", async () => {
        const onFinish = jest.fn();
        render(<Host users={users} units={units} onFinish={onFinish}
                     initialValues={{acls: [{user: null, unit: 3, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false}]}}/>);
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));

        await submitAndExpect(onFinish, 1);
        expect(submitted(onFinish).acls[0]).toMatchObject({user: null, unit: 3, read_privilege: true});
    });

    it("requires read, requires modify for delete and switches read on with create", async () => {
        const onFinish = jest.fn();
        render(<Host users={users} units={units} onFinish={onFinish}
                     initialValues={{acls: [{user: 12, unit: null, create_privilege: false, read_privilege: false, modify_privilege: false, delete_privilege: false}]}}/>);
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));

        fireEvent.click(screen.getByText("submit"));
        await waitFor(() => expect(screen.getAllByText("AclRow.validation.readRequired").length).toBeGreaterThan(0));
        expect(onFinish).not.toHaveBeenCalled();

        // Create implies read
        fireEvent.click(switches()[0]);
        await waitFor(() => expect(switches().map(checked)).toEqual([true, true, false, false]));

        // Delete without modify is refused
        fireEvent.click(switches()[3]);
        await waitFor(() => expect(screen.getAllByText("AclRow.validation.deleteNeedsModify").length).toBeGreaterThan(0));
        fireEvent.click(screen.getByText("submit"));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(onFinish).not.toHaveBeenCalled();

        fireEvent.click(switches()[2]);
        await submitAndExpect(onFinish, 1);
        expect(submitted(onFinish).acls[0]).toMatchObject({user: 12, create_privilege: true, read_privilege: true, modify_privilege: true, delete_privilege: true});
    });

    it("offers each grantee once when uniqueGrantees is set and stops adding when all are used", async () => {
        const onFinish = jest.fn();
        render(<Host users={users} units={units} uniqueGrantees onFinish={onFinish}
                     initialValues={{acls: [{user: 12, unit: null, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false}]}}/>);
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));
        const addButton = () => screen.getByText("AclRow.actions.add").closest("button") as HTMLButtonElement;
        expect(addButton().disabled).toBe(false);

        fireEvent.click(addButton());
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(2));
        fireEvent.mouseDown(screen.getAllByRole("combobox")[2]);
        await waitFor(() => expect(screen.getByText("Bea (bea)", {selector: ".ant-select-item-option-content"})).toBeTruthy());
        expect(screen.queryByText("Arnold (arnold)", {selector: ".ant-select-item-option-content"})).toBeNull();
        fireEvent.click(screen.getByText("Bea (bea)", {selector: ".ant-select-item-option-content"}));

        fireEvent.click(addButton());
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(3));
        await waitFor(() => expect(addButton().disabled).toBe(true));
        fireEvent.mouseDown(screen.getAllByRole("combobox")[5]);
        await waitFor(() => expect(screen.getByText("Editors", {selector: ".ant-select-item-option-content"})).toBeTruthy());
        fireEvent.click(screen.getByText("Editors", {selector: ".ant-select-item-option-content"}));

        await submitAndExpect(onFinish, 1);
        expect(submitted(onFinish).acls.map(row => [row.user ?? null, row.unit ?? null])).toEqual([[12, null], [13, null], [null, 3]]);
    });

    it("supports custom field names, hidden fields, a custom new row, no header and a user-only editor", async () => {
        const onFinish = jest.fn();
        render(<Host users={users} fieldName="grants" userField="user_id" unitField="unit_id" hiddenFields={["permission_id"]} showHeader={false}
                     rowTestId="grant-row" onFinish={onFinish}
                     newRow={() => ({permission_id: 7, user_id: 13, create_privilege: true, read_privilege: true, modify_privilege: false, delete_privilege: false})}/>);

        expect(screen.queryByTestId("grant-row-header")).toBeNull();
        fireEvent.click(screen.getByText("AclRow.actions.add"));
        await waitFor(() => expect(screen.getAllByTestId("grant-row")).toHaveLength(1));
        // No unit column in a user-only editor
        expect(screen.getAllByRole("combobox")).toHaveLength(1);

        await submitAndExpect(onFinish, 1);
        expect(submitted(onFinish).grants).toEqual([
            {permission_id: 7, user_id: 13, create_privilege: true, read_privilege: true, modify_privilege: false, delete_privilege: false}
        ]);
    });

    it("asks for a user in a user-only editor and honours addDisabled", async () => {
        const onFinish = jest.fn();
        render(<Host users={users} addDisabled onFinish={onFinish}
                     initialValues={{acls: [{user: null, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false}]}}/>);
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));
        expect((screen.getByText("AclRow.actions.add").closest("button") as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(screen.getByText("submit"));
        await waitFor(() => expect(screen.getByText("AclRow.validation.userRequired")).toBeTruthy());
        expect(onFinish).not.toHaveBeenCalled();
    });
});
