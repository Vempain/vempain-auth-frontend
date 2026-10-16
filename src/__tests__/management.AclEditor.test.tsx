/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Form} from "antd";
import {jest} from "@jest/globals";
import type {AclVO, UnitVO, UserVO} from "../models";
import {ACL_PRIVILEGES, AclEditor, newAclRow, unitGranteeOptions, userGranteeOptions} from "../management/AclEditor";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key})
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

function row(overrides: Partial<AclVO> = {}): AclVO {
    return {
        permission_id: 0,
        acl_id: 0,
        user: 7,
        unit: null,
        create_privilege: false,
        read_privilege: false,
        modify_privilege: false,
        delete_privilege: false, ...overrides
    };
}

function Host({acls, onValues}: { acls: AclVO[]; onValues: (values: { acls: AclVO[] }) => void }) {
    const [form] = Form.useForm();
    return (
            <Form form={form} initialValues={{acls}} onFinish={onValues}>
                <AclEditor acls={acls} parentForm={form} users={users} units={units}/>
                <button type="button" onClick={() => onValues(form.getFieldsValue())}>read values</button>
                <button type="submit">submit</button>
            </Form>
    );
}

describe("AclEditor", () => {
    it("switching create on also switches read on", async () => {
        const onValues = jest.fn();
        render(<Host acls={[row()]} onValues={onValues}/>);
        await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(4));
        const [create, read] = screen.getAllByRole("switch");

        fireEvent.click(create);

        await waitFor(() => expect(read.getAttribute("aria-checked")).toBe("true"));
        fireEvent.click(screen.getByText("read values"));
        expect(onValues.mock.calls[0][0] as { acls: AclVO[] }).toMatchObject({acls: [{create_privilege: true, read_privilege: true, modify_privilege: false}]});
    });

    it("the All button left of the switches grants every privilege of its row only", async () => {
        const onValues = jest.fn();
        render(<Host acls={[row(), row({user: null, unit: 3})]} onValues={onValues}/>);
        await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(8));
        const allButtons = screen.getAllByRole("button", {name: "Grant all privileges"});
        const firstRowSwitches = screen.getAllByRole("switch").slice(0, 4);
        expect(allButtons[0].compareDocumentPosition(firstRowSwitches[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        fireEvent.click(allButtons[1]);

        await waitFor(() => expect(screen.getAllByRole("switch").slice(4).every(s => s.getAttribute("aria-checked") === "true")).toBe(true));
        expect(firstRowSwitches.every(s => s.getAttribute("aria-checked") === "false")).toBe(true);
        fireEvent.click(screen.getByText("read values"));
        const acls = (onValues.mock.calls[0][0] as { acls: AclVO[] }).acls;
        expect(acls[1]).toMatchObject({create_privilege: true, read_privilege: true, modify_privilege: true, delete_privilege: true});
        expect(acls[0]).toMatchObject({create_privilege: false, read_privilege: false});
    });

    it("adds a row with read granted and removes rows", async () => {
        render(<Host acls={[]} onValues={jest.fn()}/>);
        fireEvent.click(await screen.findByText("Add ACL"));
        await waitFor(() => expect(screen.getAllByTestId("acl-row")).toHaveLength(1));
        expect(screen.getAllByRole("switch")[1].getAttribute("aria-checked")).toBe("true");

        fireEvent.click(screen.getByRole("button", {name: "Remove row"}));
        await waitFor(() => expect(screen.queryAllByTestId("acl-row")).toHaveLength(0));
    });

    it("submits a valid row and rejects a row that names both a user and a unit", async () => {
        const onValues = jest.fn();
        const {unmount} = render(<Host acls={[row({read_privilege: true})]} onValues={onValues}/>);
        fireEvent.click(await screen.findByText("submit"));
        await waitFor(() => expect(onValues).toHaveBeenCalledTimes(1));
        unmount();

        render(<Host acls={[row({unit: 3, read_privilege: true})]} onValues={onValues}/>);
        fireEvent.click(await screen.findByText("submit"));

        await screen.findAllByText("Select either a user or a unit, not both.");
        expect(onValues).toHaveBeenCalledTimes(1);
    });

    it("rejects a row without a grantee and a row without read", async () => {
        const onValues = jest.fn();
        const {unmount} = render(<Host acls={[row({user: null, read_privilege: true})]} onValues={onValues}/>);
        fireEvent.click(await screen.findByText("submit"));
        await screen.findAllByText("Either a user or a unit must be selected.");
        unmount();

        render(<Host acls={[row({read_privilege: false, modify_privilege: true})]} onValues={onValues}/>);
        fireEvent.click(await screen.findByText("submit"));

        await screen.findAllByText("Read privilege must be selected.");
        expect(onValues).not.toHaveBeenCalled();
    });

    it("delete requires modify, also when the switches are toggled", async () => {
        const onValues = jest.fn();
        render(<Host acls={[row({read_privilege: true})]} onValues={onValues}/>);
        await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(4));
        const [, , modify, del] = screen.getAllByRole("switch");

        fireEvent.click(del);
        // The message is shown under the modify and the delete switch
        await screen.findAllByText("Delete privilege requires modify privilege.");
        fireEvent.click(screen.getByText("submit"));
        expect(onValues).not.toHaveBeenCalled();

        fireEvent.click(modify);
        await waitFor(() => expect(screen.queryAllByText("Delete privilege requires modify privilege.")).toHaveLength(0));
        fireEvent.click(screen.getByText("submit"));
        await waitFor(() => expect(onValues).toHaveBeenCalledTimes(1));
        expect(onValues.mock.calls[0][0] as { acls: AclVO[] }).toMatchObject({acls: [{modify_privilege: true, delete_privilege: true}]});
    });
});

describe("AclEditor adapter", () => {
    it("maps users and units to grantee options and starts a new row with read granted", () => {
        expect(userGranteeOptions([{id: 5, name: "Five", nick: "5", login_name: "five"} as UserVO, {id: 6, name: "", nick: "six", login_name: "six"} as UserVO]))
                .toEqual([{value: 5, label: "Five (5)"}, {value: 6, label: "six"}]);
        expect(unitGranteeOptions([{id: 6, name: "Six"} as UnitVO])).toEqual([{value: 6, label: "Six"}]);
        expect(newAclRow()).toEqual({
            permission_id: 0, acl_id: 0, user: null, unit: null, create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false
        });
        expect(ACL_PRIVILEGES).toEqual(["create_privilege", "read_privilege", "modify_privilege", "delete_privilege"]);
    });

    it("keeps the persisted ids of a row and sends them back with the privileges", async () => {
        const onValues = jest.fn();
        render(<Host acls={[row({permission_id: 42, acl_id: 9, read_privilege: true})]} onValues={onValues}/>);
        fireEvent.click(await screen.findByText("submit"));

        await waitFor(() => expect(onValues).toHaveBeenCalledTimes(1));
        expect((onValues.mock.calls[0][0] as { acls: AclVO[] }).acls[0]).toMatchObject({permission_id: 42, acl_id: 9, user: 7, unit: null, read_privilege: true});
    });
});
