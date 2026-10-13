/**
 * @jest-environment jsdom
 */

import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import dayjs from "dayjs";
import {createRef} from "react";
import type {PagedRequest, PagedResponse} from "../models";
import type {PagedTableState} from "../main/usePagedTable";
import type {VempainColumnsType, VempainTableHandle} from "../main/VempainTable";
import {
    columnFilterKind,
    compareCellValues,
    fetchAllPages,
    isActionColumn,
    isNarrowScreen,
    reduceToSingleFilter,
    renderCollapsedValue,
    splitColumnsForMobile,
    VempainTable
} from "../main/VempainTable";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => options === undefined ? key : `${key}:${JSON.stringify(options)}`
    })
}));
jest.mock("@ant-design/icons", () => ({
    SearchOutlined: () => null
}));

// Ant Design's breakpoint observer asks matchMedia for every breakpoint; the answers follow this viewport width
let viewportWidth = 1024;

function mediaMatches(query: string): boolean {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    if (max && viewportWidth > Number(max[1])) {
        return false;
    }
    return !(min && viewportWidth < Number(min[1]));
}

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        matches: mediaMatches(query),
        media: query,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
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

interface Row {
    id: number;
    name: string;
    status: "active" | "inactive";
    email: string;
    created: string;
}

type Fetcher = (request: PagedRequest) => Promise<PagedResponse<Row>>;

const rows: Row[] = [
    {id: 1, name: "Grace", status: "active", email: "grace@example.com", created: "2024-01-01"},
    {id: 2, name: "Ada", status: "inactive", email: "ada@example.com", created: "2024-02-01"}
];

function page(content: Row[], last = true): PagedResponse<Row> {
    return {content, page: 0, size: 100, total_elements: content.length, total_pages: 1, first: true, last, empty: content.length === 0};
}

function columns(): VempainColumnsType<Row> {
    return [
        {title: "Name", dataIndex: "name", key: "name", mobile: true, sorter: true},
        {title: "Status", dataIndex: "status", key: "status", filters: [{text: "Active", value: "active"}, {text: "Inactive", value: "inactive"}]},
        {title: "Email", dataIndex: "email", key: "email"},
        {title: () => <span>Created</span>, dataIndex: "created", key: "created", searchable: false, render: value => ({children: `on ${value}`, props: {}})},
        {title: "Actions", key: "actions", render: (_value, record) => <button type="button">act {record.id}</button>}
    ];
}

function pagedState(overrides: Partial<PagedTableState<Row>> = {}): PagedTableState<Row> {
    return {
        dataSource: rows,
        loading: false,
        pagination: {current: 1, pageSize: 10, total: rows.length},
        handleTableChange: jest.fn(),
        search: "",
        setSearch: jest.fn(),
        caseSensitive: false,
        setCaseSensitive: jest.fn(),
        filterColumn: undefined,
        setFilter: jest.fn(),
        reload: jest.fn(),
        error: false,
        contextHolder: <></>,
        ...overrides
    };
}

/** The identifying cell of every data row (the expand-icon cell of the narrow layout and expanded rows are skipped) */
function rowNames(): string[] {
    return Array.from(document.querySelectorAll<HTMLTableRowElement>("tr.ant-table-row")).map(row => {
        const cells = Array.from(row.querySelectorAll("td")).filter(cell => !cell.classList.contains("ant-table-row-expand-icon-cell"));
        return cells[0]?.textContent ?? "";
    });
}

function filterTrigger(title: string): HTMLElement {
    const header = screen.getByText(title).closest("th") as HTMLElement;
    return header.querySelector(".ant-table-filter-trigger") as HTMLElement;
}

const placeholder = (column: string) => `common.table.filter.searchColumn:${JSON.stringify({column})}`;

describe("VempainTable helpers", () => {
    it("compares numbers, booleans, dates and strings and sorts empty values last", () => {
        expect(compareCellValues(1, 2)).toBeLessThan(0);
        expect(compareCellValues(true, false)).toBeGreaterThan(0);
        expect(compareCellValues(new Date("2024-01-01"), new Date("2024-02-01"))).toBeLessThan(0);
        expect(compareCellValues(dayjs("2024-03-01"), dayjs("2024-02-01"))).toBeGreaterThan(0);
        expect(compareCellValues("file10", "file9")).toBeGreaterThan(0);
        expect(compareCellValues("a", "A")).toBe(0);
        expect(compareCellValues(null, "a")).toBe(1);
        expect(compareCellValues("a", undefined)).toBe(-1);
        expect(compareCellValues("", null)).toBe(0);
        expect(compareCellValues({}, {})).toBe(0);
    });

    it("renders collapsed cells like the table does", () => {
        const column = columns()[3];
        expect(renderCollapsedValue(column, rows[0], 0)).toBe("on 2024-01-01");
        expect(renderCollapsedValue({dataIndex: "name"}, rows[0], 0)).toBe("Grace");
        expect(renderCollapsedValue({dataIndex: "name", render: () => null}, rows[0], 0)).toBe("");
        expect(renderCollapsedValue({dataIndex: "name", render: () => true}, rows[0], 0)).toBe("true");
        expect(renderCollapsedValue({dataIndex: "name", render: () => ({children: undefined, props: {}})}, rows[0], 0)).toBeNull();
        expect(renderCollapsedValue<Row>({dataIndex: ["nested", "name"]}, rows[0], 0)).toBe("");
        expect(renderCollapsedValue({key: "actions"}, rows[0], 0)).toBe("");
        const element = <b>bold</b>;
        expect(renderCollapsedValue({dataIndex: "name", render: () => element}, rows[0], 0)).toBe(element);
    });

    it("keeps a single column filter, preferring the one that changed", () => {
        expect(reduceToSingleFilter({}, {})).toEqual({});
        expect(reduceToSingleFilter({}, {name: ["a"]})).toEqual({name: ["a"]});
        expect(reduceToSingleFilter({name: ["a"]}, {name: ["a"], status: ["active"]})).toEqual({status: ["active"]});
        expect(reduceToSingleFilter({name: ["a"], status: ["active"]}, {name: ["a"], status: ["active"]})).toEqual({name: ["a"]});
        expect(reduceToSingleFilter({name: ["a"]}, {name: null, status: []})).toEqual({});
    });

    it("treats an empty or all-false breakpoint map as a wide screen", () => {
        expect(isNarrowScreen({}, "md")).toBe(false);
        expect(isNarrowScreen({xs: false, sm: false, md: false}, "md")).toBe(false);
        expect(isNarrowScreen({xs: true, sm: false, md: false}, "md")).toBe(true);
        expect(isNarrowScreen({xs: false, sm: true, md: true}, "md")).toBe(false);
    });

    it("recognises action columns and the filter kind of a column", () => {
        expect(isActionColumn({key: "actions"})).toBe(true);
        expect(isActionColumn({dataIndex: "row_action"})).toBe(true);
        expect(isActionColumn({key: ["a", "b"] as never})).toBe(false);
        expect(isActionColumn({})).toBe(false);
        expect(columnFilterKind({key: "actions"})).toBeUndefined();
        expect(columnFilterKind({title: "Group", children: []})).toBeUndefined();
        expect(columnFilterKind({dataIndex: "status", filters: []})).toBe("enum");
        expect(columnFilterKind({dataIndex: "name"})).toBe("text");
        expect(columnFilterKind({dataIndex: "name", searchable: false})).toBeUndefined();
        expect(splitColumnsForMobile<Row>([{key: "actions"}, {dataIndex: "name"}, {dataIndex: "email"}]).visible)
                .toEqual([{key: "actions"}, {dataIndex: "name"}]);
    });

    it("stops the page walk at the page limit and on an empty page", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        const endless = jest.fn<Fetcher>().mockResolvedValue(page(rows, false));
        await expect(fetchAllPages(endless, 2)).resolves.toEqual({rows: [...rows, ...rows], truncated: true});
        expect(endless).toHaveBeenCalledTimes(2);
        expect(warnSpy).toHaveBeenCalledWith("Table data fetch stopped at the page limit");

        const empty = jest.fn<Fetcher>().mockResolvedValueOnce(page(rows, false)).mockResolvedValueOnce(page([], false));
        await expect(fetchAllPages(empty)).resolves.toEqual({rows, truncated: false});
        warnSpy.mockRestore();
    });
});

describe("VempainTable in client mode", () => {
    beforeEach(() => {
        viewportWidth = 1024;
    });

    it("filters by column text, resets the filter and sorts with the default comparator", async () => {
        const ref = createRef<VempainTableHandle>();
        render(<VempainTable<Row> ref={ref} columns={columns()} dataSource={rows} rowKey="id"/>);
        expect(rowNames()).toEqual(["Grace", "Ada"]);
        // A table fed through dataSource has nothing to reload; the handle still exists
        act(() => ref.current?.reload());
        expect(rowNames()).toEqual(["Grace", "Ada"]);

        fireEvent.click(filterTrigger("Email"));
        const input = await screen.findByPlaceholderText(placeholder("Email"));
        fireEvent.change(input, {target: {value: "ada@"}});
        fireEvent.keyDown(input, {key: "Enter", code: "Enter"});
        await waitFor(() => expect(rowNames()).toEqual(["Ada"]));

        fireEvent.click(filterTrigger("Email"));
        fireEvent.click(await screen.findByText("common.table.filter.reset"));
        await waitFor(() => expect(rowNames()).toEqual(["Grace", "Ada"]));

        fireEvent.click(screen.getByText("Name"));
        await waitFor(() => expect(rowNames()).toEqual(["Ada", "Grace"]));
    });

    it("filters enum columns through a select", async () => {
        render(<VempainTable<Row> columns={columns()} dataSource={rows} rowKey="id"/>);

        fireEvent.click(filterTrigger("Status"));
        const select = await screen.findByLabelText(placeholder("Status"));
        // Keyboard navigation inside the dropdown must not reach the table header
        fireEvent.keyDown(select, {key: "ArrowDown", code: "ArrowDown"});
        fireEvent.mouseDown(select);
        fireEvent.click(await screen.findByText("Inactive"));
        await waitFor(() => expect(rowNames()).toEqual(["Ada"]));

        fireEvent.click(filterTrigger("Status"));
        fireEvent.click(await screen.findByText("common.table.filter.reset"));
        await waitFor(() => expect(rowNames()).toEqual(["Grace", "Ada"]));
    });

    it("loads every page through the fetcher and reloads through the handle and the token", async () => {
        const fetcher = jest.fn<Fetcher>().mockResolvedValue(page(rows));
        const ref = createRef<VempainTableHandle>();
        const {rerender} = render(<VempainTable<Row> ref={ref} columns={columns()} fetcher={fetcher} rowKey="id" reloadToken={1}/>);

        await screen.findByText("Grace");
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher).toHaveBeenCalledWith({page: 0, size: 100});

        act(() => ref.current?.reload());
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

        rerender(<VempainTable<Row> ref={ref} columns={columns()} fetcher={fetcher} rowKey="id" reloadToken={2}/>);
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));

        rerender(<VempainTable<Row> ref={ref} columns={columns()} fetcher={fetcher} rowKey="id" reloadToken={2} fetchEnabled={false}/>);
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it("reports a failed fetch and a truncated walk through the screen's message API", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        const messageApi = {error: jest.fn(), warning: jest.fn()} as never;
        const failing = jest.fn<Fetcher>().mockRejectedValue(new Error("down"));
        const {unmount} = render(<VempainTable<Row> columns={columns()} fetcher={failing} rowKey="id" messageApi={messageApi}/>);

        await waitFor(() => expect((messageApi as { error: jest.Mock }).error).toHaveBeenCalledWith("common.table.loadError"));
        expect(errorSpy).toHaveBeenCalledWith("Failed to load table data");
        unmount();

        const endless = jest.fn<Fetcher>().mockResolvedValue(page(rows, false));
        render(<VempainTable<Row> columns={columns()} fetcher={endless} rowKey="id" messageApi={messageApi}/>);

        await waitFor(() => expect((messageApi as { warning: jest.Mock }).warning).toHaveBeenCalledWith('common.table.fetchLimitReached:{"rows":100}'));
        expect(endless).toHaveBeenCalledTimes(50);
        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it("reports a failed fetch through its own message holder", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const failing = jest.fn<Fetcher>().mockRejectedValue(new Error("down"));
        render(<VempainTable<Row> columns={columns()} fetcher={failing} rowKey="id"/>);

        await screen.findByText("common.table.loadError");
        errorSpy.mockRestore();
    });
});

describe("VempainTable in server mode", () => {
    beforeEach(() => {
        viewportWidth = 1024;
    });

    it("sends one column filter at a time to the paged state and the onChange prop", async () => {
        const paged = pagedState();
        const onChange = jest.fn();
        const ref = createRef<VempainTableHandle>();
        render(<VempainTable<Row> ref={ref} dataMode="server" paged={paged} columns={columns()} rowKey="id" onChange={onChange}/>);
        expect(rowNames()).toEqual(["Grace", "Ada"]);

        fireEvent.click(filterTrigger("Email"));
        const input = await screen.findByPlaceholderText(placeholder("Email"));
        fireEvent.change(input, {target: {value: "ada"}});
        fireEvent.keyDown(input, {key: "Enter", code: "Enter"});

        await waitFor(() => expect(paged.handleTableChange).toHaveBeenCalled());
        expect((paged.handleTableChange as jest.Mock).mock.calls.at(-1)?.[1]).toEqual({email: ["ada"]});
        expect(onChange).toHaveBeenCalled();
        // The backend never filters locally: both rows stay until the paged state changes
        expect(rowNames()).toEqual(["Grace", "Ada"]);

        fireEvent.click(filterTrigger("Status"));
        fireEvent.mouseDown(await screen.findByLabelText(placeholder("Status")));
        fireEvent.click(await screen.findByText("Active"));
        await waitFor(() => expect((paged.handleTableChange as jest.Mock).mock.calls.at(-1)?.[1]).toEqual({status: ["active"]}));

        act(() => ref.current?.reload());
        expect(paged.reload).toHaveBeenCalledTimes(1);
    });

    it("shows the paged loading state and warns without a paged state", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const {container, rerender} = render(<VempainTable<Row> dataMode="server" paged={pagedState({loading: true})} columns={columns()} rowKey="id"/>);
        expect(container.querySelector(".ant-spin")).not.toBeNull();

        rerender(<VempainTable<Row> dataMode="server" columns={columns()} dataSource={rows} rowKey="id"/>);
        await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("VempainTable in server mode needs the `paged` state of usePagedTable"));
        expect(rowNames()).toEqual(["Grace", "Ada"]);
        errorSpy.mockRestore();
    });
});

describe("VempainTable on a narrow screen", () => {
    beforeAll(() => {
        jest.setTimeout(15000);
    });

    afterAll(() => {
        jest.setTimeout(5000);
    });

    beforeEach(() => {
        viewportWidth = 400;
    });

    it("collapses the non-mobile columns into the expandable row and searches from there", async () => {
        render(
                <VempainTable<Row>
                        columns={columns()}
                        dataSource={rows}
                        rowKey="id"
                        expandable={{expandedRowRender: record => <i>extra {record.name}</i>, rowExpandable: record => record.id === 1}}
                />
        );

        const expandButtons = await screen.findAllByRole("button", {name: "Expand row"});
        expect(expandButtons).toHaveLength(2);
        expect(screen.queryByText("Email")).toBeNull();
        expect(screen.getByText("act 1")).toBeTruthy();

        fireEvent.click(expandButtons[0]);
        await screen.findByText("grace@example.com");
        expect(screen.getByText("Created")).toBeTruthy();
        expect(screen.getByText("on 2024-01-01")).toBeTruthy();
        expect(screen.getByText("extra Grace")).toBeTruthy();
        expect(screen.queryByRole("button", {name: placeholder("Created")})).toBeNull();

        // Text search of a collapsed column
        fireEvent.click(screen.getByRole("button", {name: placeholder("Email")}));
        const search = await screen.findByPlaceholderText(placeholder("Email"));
        expect((search as HTMLInputElement).value).toBe("grace@example.com");
        fireEvent.change(search, {target: {value: "ada"}});
        fireEvent.keyDown(search, {key: "Enter", code: "Enter"});
        await waitFor(() => expect(rowNames()).toEqual(["Ada"]));

        // The second row carries no extra content; its expanded row shows the current filter value
        fireEvent.click(screen.getByRole("button", {name: "Expand row"}));
        await screen.findByText("ada@example.com");
        expect(screen.queryByText("extra Ada")).toBeNull();
        fireEvent.click(screen.getByRole("button", {name: placeholder("Email")}));
        const again = await screen.findByPlaceholderText(placeholder("Email"));
        expect((again as HTMLInputElement).value).toBe("ada");
        fireEvent.blur(again);
        await waitFor(() => expect(screen.queryByPlaceholderText(placeholder("Email"))).toBeNull());

        // Clearing the search restores every row
        fireEvent.click(screen.getByRole("button", {name: placeholder("Email")}));
        const cleared = await screen.findByPlaceholderText(placeholder("Email"));
        fireEvent.change(cleared, {target: {value: ""}});
        fireEvent.keyDown(cleared, {key: "Enter", code: "Enter"});
        await waitFor(() => expect(rowNames()).toEqual(["Grace", "Ada"]));
    });

    it("filters an enum column from the collapsed row through a select", async () => {
        render(<VempainTable<Row> columns={columns()} dataSource={rows} rowKey="id"/>);

        fireEvent.click((await screen.findAllByRole("button", {name: "Expand row"}))[0]);
        fireEvent.click(await screen.findByRole("button", {name: placeholder("Status")}));
        fireEvent.mouseDown(await screen.findByRole("combobox", {name: placeholder("Status")}));
        fireEvent.click(await screen.findByText("Inactive"));

        await waitFor(() => expect(rowNames()).toEqual(["Ada"]));
    });

    it("replaces the backend filter from the collapsed row in server mode", async () => {
        const paged = pagedState();
        render(<VempainTable<Row> dataMode="server" paged={paged} columns={columns()} rowKey="id"/>);

        fireEvent.click((await screen.findAllByRole("button", {name: "Expand row"}))[0]);
        fireEvent.click(await screen.findByRole("button", {name: placeholder("Email")}));
        const search = await screen.findByPlaceholderText(placeholder("Email"));
        fireEvent.change(search, {target: {value: "ada"}});
        fireEvent.keyDown(search, {key: "Enter", code: "Enter"});
        await waitFor(() => expect(paged.setFilter).toHaveBeenLastCalledWith("email", "ada"));

        fireEvent.click(await screen.findByRole("button", {name: placeholder("Email")}));
        const cleared = await screen.findByPlaceholderText(placeholder("Email"));
        fireEvent.change(cleared, {target: {value: ""}});
        fireEvent.keyDown(cleared, {key: "Enter", code: "Enter"});
        await waitFor(() => expect(paged.setFilter).toHaveBeenLastCalledWith(undefined, ""));
    });

    it("renders a plain small table when every column stays visible", async () => {
        const {container} = render(
                <VempainTable<Row> columns={[{title: "Name", dataIndex: "name", key: "name", mobile: true}, {title: "Actions", key: "actions"}]}
                                   dataSource={rows} rowKey="id"/>
        );

        await waitFor(() => expect(container.querySelector(".ant-table-small")).not.toBeNull());
        expect(screen.queryByRole("button", {name: "Expand row"})).toBeNull();
        expect(rowNames()).toEqual(["Grace", "Ada"]);
    });
});
