/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import type {UnitVO, UserVO} from "../models";
import {UnitEditor} from "../management/UnitEditor";
import type {UnitAPI} from "../services/UnitAPI";
import type {UserAPI} from "../services/UserAPI";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, options?: { defaultValue?: string; name?: string | number }) =>
                (options?.defaultValue ?? _key).replace("{{name}}", String(options?.name ?? ""))
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
if (typeof globalThis.ResizeObserver === "undefined") {
    Object.defineProperty(globalThis, "ResizeObserver", {
        writable: true,
        value: class {
            observe() {
            }

            unobserve() {
            }

            disconnect() {
            }
        }
    });
}

function unit(id: number, name: string, unit_ids: number[] = []): UnitVO {
    return {id, name, description: "", acls: [], user_ids: [], unit_ids, locked: false, creator: 1, created: null as never, modifier: null, modified: null};
}

// grand (1) contains parent (2) contains child (3); other (5) is separate
const allUnits = [unit(1, "grand", [2]), unit(2, "parent", [3]), unit(3, "child"), unit(5, "other")];
const users = [{id: 7, name: "Seven", login_name: "seven"}] as UserVO[];

function page<T>(content: T[]) {
    return {content, page: 0, size: 500, total_elements: content.length, total_pages: 1, first: true, last: true, empty: content.length === 0};
}

function apis(editing: UnitVO) {
    const unitAPI = {
        findById: jest.fn(async () => editing),
        findPageable: jest.fn(async () => page(allUnits)),
        update: jest.fn(async (payload: UnitVO) => payload),
        create: jest.fn(async (payload: UnitVO) => ({...payload, id: 99}))
    } as unknown as UnitAPI;
    const userAPI = {findPageable: jest.fn(async () => page(users))} as unknown as UserAPI;
    return {unitAPI, userAPI};
}

describe("UnitEditor", () => {
    it("offers only units that cannot contain the edited unit and submits the members", async () => {
        const {unitAPI, userAPI} = apis(allUnits[2]);
        const onSaved = jest.fn();
        render(<UnitEditor unitAPI={unitAPI} userAPI={userAPI} unitId={3} onSaved={onSaved}/>);
        await screen.findByText("Edit unit child");

        // Open the member unit select: grand and parent contain child, so only other is offered
        const selects = screen.getAllByRole("combobox");
        fireEvent.mouseDown(selects[1]);
        await screen.findByText("other");
        expect(screen.queryByText("grand")).toBeNull();
        expect(screen.queryByText("parent")).toBeNull();
        fireEvent.click(screen.getByText("other"));

        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect((unitAPI.update as jest.Mock).mock.calls[0][0]).toMatchObject({id: 3, name: "child", unit_ids: [5], user_ids: []});
    });

    it("refuses a circular choice before sending it", async () => {
        // The stored data already nests child inside parent; a stale form value containing parent must be rejected
        const {unitAPI, userAPI} = apis({...allUnits[2], unit_ids: [2]});
        const onSaved = jest.fn();
        render(<UnitEditor unitAPI={unitAPI} userAPI={userAPI} unitId={3} onSaved={onSaved}/>);
        await screen.findByText("Edit unit child");

        fireEvent.click(screen.getByText("Save"));

        await screen.findByText("A unit can not contain itself, directly or through other units");
        expect(onSaved).not.toHaveBeenCalled();
        expect(unitAPI.update).not.toHaveBeenCalled();
    });

    it("creates a new unit with the signed-in user on its ACL", async () => {
        const {unitAPI, userAPI} = apis(allUnits[0]);
        const onSaved = jest.fn();
        render(<UnitEditor unitAPI={unitAPI} userAPI={userAPI} unitId={0} currentUserId={7} onSaved={onSaved}/>);
        await screen.findByText("Create new unit");
        expect(unitAPI.findById).not.toHaveBeenCalled();
        expect(screen.getAllByTestId("acl-row")).toHaveLength(1);

        fireEvent.change(screen.getAllByRole("textbox")[0], {target: {value: "new unit"}});
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        const payload = (unitAPI.create as jest.Mock).mock.calls[0][0] as UnitVO;
        expect(payload.name).toBe("new unit");
        expect(payload.acls).toEqual([{
            permission_id: 0,
            acl_id: 0,
            user: 7,
            unit: null,
            create_privilege: true,
            read_privilege: true,
            modify_privilege: true,
            delete_privilege: true
        }]);
    });
});
