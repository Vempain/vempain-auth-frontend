/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import dayjs from "dayjs";
import type {UnitVO, UserVO} from "../models";
import {AuditLine, UserEditor} from "../management/UserEditor";
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

function user(id: number, name: string, overrides: Partial<UserVO> = {}): UserVO {
    return {
        id, name, nick: name.toLowerCase(), login_name: name.toLowerCase(), private_user: false, privacy_type: "PRIVATE",
        email: `${name.toLowerCase()}@example.com`, street: "", pob: "", birthday: new Date("1990-01-01"), description: "", password: "",
        acls: [{
            permission_id: 1,
            acl_id: 5,
            user: id,
            unit: null,
            create_privilege: true,
            read_privilege: true,
            modify_privilege: true,
            delete_privilege: true
        }],
        unit_ids: [3], creator: 1, created: dayjs("2024-01-02T03:04:00"), modifier: null, modified: null, locked: false,
        ...overrides
    };
}

const units = [{id: 3, name: "Unit three"}, {id: 4, name: "Unit four"}] as UnitVO[];
const allUsers = [user(1, "Admin"), user(7, "Seven")];

function page<T>(content: T[]) {
    return {content, page: 0, size: 500, total_elements: content.length, total_pages: 1, first: true, last: true, empty: content.length === 0};
}

function apis(editing: UserVO) {
    const userAPI = {
        findById: jest.fn(async (id: number) => id === editing.id ? editing : allUsers.find(candidate => candidate.id === id) ?? editing),
        findPageable: jest.fn(async () => page(allUsers)),
        update: jest.fn(async (payload: UserVO) => payload),
        create: jest.fn(async (payload: UserVO) => ({...payload, id: 99}))
    } as unknown as UserAPI;
    const unitAPI = {
        findPageable: jest.fn(async () => page(units))
    } as unknown as UnitAPI;
    return {userAPI, unitAPI};
}

describe("UserEditor", () => {
    let errorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("edits an existing user, keeps the password when blank and submits the ACL and units", async () => {
        const editing = user(7, "Seven");
        const {userAPI, unitAPI} = apis(editing);
        const onSaved = jest.fn();
        const onCancel = jest.fn();
        render(<UserEditor userAPI={userAPI} unitAPI={unitAPI} userId={7} currentUserId={1} onSaved={onSaved} onCancel={onCancel}/>);

        await screen.findByText("Edit user Seven");
        expect(userAPI.findById).toHaveBeenCalledWith(7, null);
        expect(screen.getAllByTestId("acl-row")).toHaveLength(1);
        expect(screen.getByText("Leave empty to keep the current password")).toBeTruthy();
        expect(screen.getByText("Created by")).toBeTruthy();
        await screen.findByText("Admin (admin)");
        expect(screen.getByText("2024-01-02 03:04")).toBeTruthy();

        fireEvent.change(screen.getByLabelText("Name"), {target: {value: "Seven Renamed"}});
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        const payload = (userAPI.update as jest.Mock).mock.calls[0][0] as UserVO;
        expect(payload).toMatchObject({id: 7, name: "Seven Renamed", password: "", unit_ids: [3]});
        expect(payload.acls).toEqual(editing.acls);
        expect(userAPI.create).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("Cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("creates a new user with the signed-in user on its ACL and requires a password", async () => {
        const {userAPI, unitAPI} = apis(user(0, ""));
        const onSaved = jest.fn();
        render(<UserEditor userAPI={userAPI} unitAPI={unitAPI} userId={0} currentUserId={1} onSaved={onSaved}/>);

        await screen.findByText("Create new user");
        expect(userAPI.findById).not.toHaveBeenCalled();
        expect(screen.getAllByTestId("acl-row")).toHaveLength(1);
        expect(screen.queryByText("Created by")).toBeNull();
        expect(screen.queryByText("Cancel")).toBeNull();

        fireEvent.change(screen.getByLabelText("Login name"), {target: {value: "nine"}});
        fireEvent.change(screen.getByLabelText("Name"), {target: {value: "Nine"}});
        fireEvent.change(screen.getByLabelText("Nick"), {target: {value: "nine"}});
        fireEvent.change(screen.getByLabelText("Email"), {target: {value: "nine@example.com"}});
        fireEvent.click(screen.getByText("Save"));

        // The password is required for a new user
        await waitFor(() => expect(screen.queryAllByText(/required/).length).toBeGreaterThan(0));
        expect(userAPI.create).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("Password"), {target: {value: "secret"}});
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        const payload = (userAPI.create as jest.Mock).mock.calls[0][0] as UserVO;
        expect(payload).toMatchObject({id: 0, login_name: "nine", name: "Nine", nick: "nine", email: "nine@example.com", password: "secret", unit_ids: []});
        expect(payload.acls).toEqual([{
            permission_id: 0, acl_id: 0, user: 1, unit: null,
            create_privilege: true, read_privilege: true, modify_privilege: true, delete_privilege: true
        }]);
        expect(onSaved.mock.calls[0][0]).toMatchObject({id: 99});
    });

    it("starts a new user without an ACL row when no signed-in user is given", async () => {
        const {userAPI, unitAPI} = apis(user(0, ""));
        render(<UserEditor userAPI={userAPI} unitAPI={unitAPI} userId={0} onSaved={jest.fn()}/>);

        await screen.findByText("Create new user");
        expect(screen.queryAllByTestId("acl-row")).toHaveLength(0);
    });

    it("shows a load error when the user cannot be fetched", async () => {
        const {userAPI, unitAPI} = apis(user(7, "Seven"));
        (userAPI.findById as jest.Mock).mockImplementation(async () => {
            throw new Error("not found");
        });
        render(<UserEditor userAPI={userAPI} unitAPI={unitAPI} userId={7} onSaved={jest.fn()}/>);

        await screen.findByText("Failed to load the user, try again later");
        expect(screen.getByText("Edit user 7")).toBeTruthy();
        expect(screen.queryByText("Save")).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith("Failed to load the user:", expect.any(Error));
    });

    it("shows an update error and a create error when saving fails", async () => {
        const {userAPI, unitAPI} = apis(user(7, "Seven"));
        (userAPI.update as jest.Mock).mockImplementation(async () => {
            throw new Error("conflict");
        });
        (userAPI.create as jest.Mock).mockImplementation(async () => {
            throw new Error("conflict");
        });
        const onSaved = jest.fn();
        const {unmount} = render(<UserEditor userAPI={userAPI} unitAPI={unitAPI} userId={7} onSaved={onSaved}/>);
        await screen.findByText("Edit user Seven");

        fireEvent.click(screen.getByText("Save"));
        await screen.findByText("Failed to update the user");
        expect(onSaved).not.toHaveBeenCalled();
        unmount();

        render(<UserEditor userAPI={userAPI} unitAPI={unitAPI} userId={0} currentUserId={1} onSaved={onSaved}/>);
        await screen.findByText("Create new user");
        fireEvent.change(screen.getByLabelText("Login name"), {target: {value: "nine"}});
        fireEvent.change(screen.getByLabelText("Name"), {target: {value: "Nine"}});
        fireEvent.change(screen.getByLabelText("Nick"), {target: {value: "nine"}});
        fireEvent.change(screen.getByLabelText("Email"), {target: {value: "nine@example.com"}});
        fireEvent.change(screen.getByLabelText("Password"), {target: {value: "secret"}});
        fireEvent.click(screen.getByText("Save"));

        await screen.findByText("Failed to create the user");
        expect(onSaved).not.toHaveBeenCalled();
    });

    it("lets the host render its own metadata and falls back to the nick when the name is missing", async () => {
        const {userAPI, unitAPI} = apis(user(7, "Seven", {name: null as never, nick: "sev"}));
        const renderMetadata = jest.fn(() => <span>custom metadata</span>);
        render(<UserEditor userAPI={userAPI} unitAPI={unitAPI} userId={7} onSaved={jest.fn()} renderMetadata={renderMetadata}/>);

        await screen.findByText("custom metadata");
        expect(screen.getByText("Edit user sev")).toBeTruthy();
        expect(renderMetadata).toHaveBeenCalledWith(expect.objectContaining({creator: 1, modifier: null, modified: null}));
        expect(screen.queryByText("Created by")).toBeNull();
    });
});

describe("AuditLine", () => {
    it("shows the creator and modifier names with their timestamps", async () => {
        const {userAPI} = apis(user(7, "Seven"));
        render(<AuditLine userAPI={userAPI} metadata={{
            creator: 1, created: dayjs("2024-01-02T03:04:00"), modifier: 7, modified: dayjs("2024-05-06T07:08:00")
        }}/>);

        await screen.findByText("Admin (admin)");
        await screen.findByText("Seven (seven)");
        expect(screen.getByText("2024-01-02 03:04")).toBeTruthy();
        expect(screen.getByText("2024-05-06 07:08")).toBeTruthy();
    });

    it("shows dashes for a missing modifier", async () => {
        const {userAPI} = apis(user(7, "Seven"));
        render(<AuditLine userAPI={userAPI} metadata={{creator: 1, created: dayjs("2024-01-02T03:04:00"), modifier: null, modified: null}}/>);

        await screen.findByText("Admin (admin)");
        expect(screen.getAllByText("–")).toHaveLength(2);
    });
});
