/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {jest} from "@jest/globals";
import type {PagedRequest, PagedResponse, UnitVO} from "../models";
import {UnitList} from "../management/UnitList";
import type {UnitAPI} from "../services/UnitAPI";

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

const units = [
    {id: 1, name: "grand", description: "top", user_ids: [7, 8, 9], unit_ids: [2]},
    {id: 2, name: "parent", description: "", user_ids: undefined, unit_ids: undefined}
] as unknown as UnitVO[];

function page(content: UnitVO[]): PagedResponse<UnitVO> {
    return {content, page: 0, size: 10, total_elements: content.length, total_pages: 1, first: true, last: true, empty: content.length === 0};
}

describe("UnitList", () => {
    it("lists the units with their member counts and offers edit and create actions", async () => {
        const findPageable = jest.fn<(request: PagedRequest) => Promise<PagedResponse<UnitVO>>>().mockResolvedValue(page(units));
        const unitAPI = {findPageable} as unknown as UnitAPI;
        const onEdit = jest.fn();
        const onCreate = jest.fn();

        render(<UnitList unitAPI={unitAPI} onEdit={onEdit} onCreate={onCreate}/>);

        await screen.findByText("grand");
        expect(screen.getByText("Units")).toBeTruthy();
        expect(findPageable).toHaveBeenCalledWith({page: 0, size: 10, sort_by: "name", direction: "ASC"});
        const cells = Array.from((screen.getByText("grand").closest("tr") as HTMLTableRowElement).querySelectorAll("td")).map(cell => cell.textContent);
        expect(cells.slice(0, 5)).toEqual(["1", "grand", "top", "3", "1"]);
        const otherCells = Array.from((screen.getByText("parent").closest("tr") as HTMLTableRowElement).querySelectorAll("td")).map(cell => cell.textContent);
        expect(otherCells.slice(3, 5)).toEqual(["0", "0"]);

        fireEvent.click(screen.getAllByRole("button", {name: "Edit unit"})[0]);
        expect(onEdit).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByText("Create unit"));
        expect(onCreate).toHaveBeenCalledTimes(1);
    });
});
