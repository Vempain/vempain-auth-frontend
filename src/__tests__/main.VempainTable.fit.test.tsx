/**
 * @jest-environment jsdom
 */
/**
 * Tests of the width fitting of VempainTable: on a wide screen the columns that do not fit the container move into the
 * expandable row, least important first, down to the identifying and action columns.
 */
import {act, render, screen} from "@testing-library/react";
import {
    DEFAULT_ACTION_COLUMN_WIDTH,
    DEFAULT_COLUMN_WIDTH,
    estimateColumnWidth,
    fitColumnsToWidth,
    VempainTable,
    type VempainColumnsType
} from "../main";

// The icon package ships ESM only, which this CommonJS Jest setup cannot load; the search icon is not under test here
jest.mock("@ant-design/icons", () => ({
    SearchOutlined: () => null
}));

jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string, options?: Record<string, unknown>) => (options?.column ? `${key}:${options.column}` : key)})
}));

// A wide viewport: every breakpoint matches, so the breakpoint collapse never happens here
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        matches: true, media: query, addListener: () => undefined, removeListener: () => undefined,
        addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false
    })
});

// A ResizeObserver stub the tests drive by hand: the last observer created receives the widths the tests announce
type ResizeCallback = (entries: Array<{contentRect: {width: number}}>) => void;
let lastResizeCallback: ResizeCallback | undefined;
Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: class {
        constructor(callback: ResizeCallback) {
            lastResizeCallback = callback;
        }

        observe() {
        }

        unobserve() {
        }

        disconnect() {
        }
    }
});

function announceWidth(width: number) {
    act(() => {
        lastResizeCallback?.([{contentRect: {width}}]);
    });
}

interface Row {
    id: number;
    name: string;
    description: string;
    created: string;
    modified: string;
}

const rows: Row[] = [
    {id: 1, name: "Summer", description: "Summer pictures", created: "2026-01-01", modified: "2026-02-01"},
    {id: 2, name: "Winter", description: "Snow", created: "2026-01-05", modified: "2026-02-05"}
];

function columns(): VempainColumnsType<Row> {
    return [
        {title: "ID", dataIndex: "id", key: "id", mobile: true, width: 80},
        {title: "Name", dataIndex: "name", key: "name", priority: 1, width: 200},
        {title: "Description", dataIndex: "description", key: "description", width: 300},
        {title: "Created", dataIndex: "created", key: "created", priority: 3, width: 160},
        {title: "Modified", dataIndex: "modified", key: "modified", priority: 2, width: 160},
        {title: "Action", key: "action", width: 100, render: (_value, record) => <button type="button">act {record.id}</button>}
    ];
}

function headerTitles(): string[] {
    return screen.getAllByRole("columnheader").map((header) => header.textContent?.trim() ?? "").filter((text) => text !== "");
}

describe("estimateColumnWidth", () => {
    it("uses the numeric width, then minWidth, then an estimate from the title", () => {
        expect(estimateColumnWidth({title: "Name", width: 240})).toBe(240);
        expect(estimateColumnWidth({title: "Name", width: "20%", minWidth: 150})).toBe(150);
        expect(estimateColumnWidth({title: "ID"})).toBe(DEFAULT_COLUMN_WIDTH);
        expect(estimateColumnWidth({title: "A very long column title"})).toBe("A very long column title".length * 9 + 32);
        expect(estimateColumnWidth({title: "A very long column title", sorter: true})).toBe("A very long column title".length * 9 + 32 + 24);
        expect(estimateColumnWidth({title: "Action", key: "action"})).toBe(DEFAULT_ACTION_COLUMN_WIDTH);
        expect(estimateColumnWidth({title: <span>Node</span>, key: "x"})).toBe(DEFAULT_COLUMN_WIDTH);
    });
});

describe("fitColumnsToWidth", () => {
    const titles = (list: VempainColumnsType<Row>) => list.map((column) => column.title);

    it("keeps every column while the width is unknown or large enough", () => {
        expect(fitColumnsToWidth(columns(), 0).collapsed).toEqual([]);
        expect(fitColumnsToWidth(columns(), 1000).collapsed).toEqual([]);
    });

    it("drops the unprioritised columns first, then the highest priority numbers, never the identifying or action columns", () => {
        // 1000 needed: Description (no priority) goes first
        expect(titles(fitColumnsToWidth(columns(), 800).visible)).toEqual(["ID", "Name", "Created", "Modified", "Action"]);
        // then Created (priority 3) before Modified (priority 2)
        expect(titles(fitColumnsToWidth(columns(), 600).visible)).toEqual(["ID", "Name", "Modified", "Action"]);
        expect(titles(fitColumnsToWidth(columns(), 400).visible)).toEqual(["ID", "Name", "Action"]);
        // nothing fits but the essentials, which are never dropped
        expect(titles(fitColumnsToWidth(columns(), 100).visible)).toEqual(["ID", "Action"]);
        expect(titles(fitColumnsToWidth(columns(), 100).collapsed)).toEqual(["Name", "Description", "Created", "Modified"]);
    });

    it("drops unprioritised columns from the right and uses the first data column as the identifier without a mobile flag", () => {
        const plain: VempainColumnsType<Row> = [
            {title: "ID", dataIndex: "id", key: "id", width: 100},
            {title: "Name", dataIndex: "name", key: "name", width: 100},
            {title: "Description", dataIndex: "description", key: "description", width: 100},
            {title: "Action", key: "action", width: 100}
        ];
        expect(titles(fitColumnsToWidth(plain, 300).visible)).toEqual(["ID", "Name", "Action"]);
        expect(titles(fitColumnsToWidth(plain, 150).visible)).toEqual(["ID", "Action"]);
    });
});

describe("VempainTable fitting its container", () => {
    it("shows every column until the container is measured too narrow, then lists the dropped ones in the expanded row", () => {
        render(<VempainTable<Row> columns={columns()} dataSource={rows} rowKey="id" pagination={false}/>);
        expect(headerTitles()).toEqual(["ID", "Name", "Description", "Created", "Modified", "Action"]);

        announceWidth(600);
        expect(headerTitles()).toEqual(["ID", "Name", "Modified", "Action"]);
        // the dropped columns are listed in the expandable row
        const expandButtons = screen.getAllByRole("button", {name: /expand row/i});
        act(() => {
            expandButtons[0].click();
        });
        expect(screen.getByText("Description")).toBeTruthy();
        expect(screen.getByText("Summer pictures")).toBeTruthy();
        expect(screen.getByText("Created")).toBeTruthy();

        // widening the container brings the columns back
        announceWidth(1200);
        expect(headerTitles()).toEqual(["ID", "Name", "Description", "Created", "Modified", "Action"]);
    });

    it("keeps only the identifying and action columns in the narrowest container", () => {
        render(<VempainTable<Row> columns={columns()} dataSource={rows} rowKey="id" pagination={false}/>);
        announceWidth(150);
        expect(headerTitles()).toEqual(["ID", "Action"]);
        expect(screen.getAllByRole("button", {name: /act \d/})).toHaveLength(2);
    });
});
