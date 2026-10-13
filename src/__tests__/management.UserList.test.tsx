/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import type {PagedRequest, PagedResponse, UserVO} from "../models";
import {UserList} from "../management/UserList";
import type {UserAPI} from "../services/UserAPI";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key})
}));
jest.mock("@ant-design/icons", () => ({
    EditOutlined: () => null,
    PlusCircleFilled: () => null,
    SearchOutlined: () => null
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

const users = [
    {id: 7, login_name: "seven", name: "Seven", nick: "sev", email: "seven@example.com", unit_ids: [1, 2]},
    {id: 8, login_name: "eight", name: "Eight", nick: "ei", email: "eight@example.com", unit_ids: undefined}
] as unknown as UserVO[];

function page(content: UserVO[]): PagedResponse<UserVO> {
    return {content, page: 0, size: 10, total_elements: content.length, total_pages: 1, first: true, last: true, empty: content.length === 0};
}

describe("UserList", () => {
    it("lists the users of the backend sorted by name and offers edit and create actions", async () => {
        const findPageable = jest.fn<(request: PagedRequest) => Promise<PagedResponse<UserVO>>>().mockResolvedValue(page(users));
        const userAPI = {findPageable} as unknown as UserAPI;
        const onEdit = jest.fn();
        const onCreate = jest.fn();

        render(<UserList userAPI={userAPI} onEdit={onEdit} onCreate={onCreate}/>);

        await screen.findByText("seven");
        expect(screen.getByText("Users")).toBeTruthy();
        expect(findPageable).toHaveBeenCalledWith({page: 0, size: 10, sort_by: "name", direction: "ASC"});
        const row = screen.getByText("seven").closest("tr") as HTMLTableRowElement;
        expect(row.textContent).toContain("2");
        const otherRow = screen.getByText("eight").closest("tr") as HTMLTableRowElement;
        expect(otherRow.textContent).toContain("0");

        fireEvent.click(screen.getAllByRole("button", {name: "Edit user"})[1]);
        expect(onEdit).toHaveBeenCalledWith(8);

        fireEvent.click(screen.getByText("Create user"));
        expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it("reports a failed load through the table message holder", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const findPageable = jest.fn<(request: PagedRequest) => Promise<PagedResponse<UserVO>>>().mockRejectedValue(new Error("down"));
        const userAPI = {findPageable} as unknown as UserAPI;

        render(<UserList userAPI={userAPI} onEdit={jest.fn()} onCreate={jest.fn()}/>);

        await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("Failed to load a page of table data"));
        await screen.findByText("common.table.loadError");
        errorSpy.mockRestore();
    });
});
