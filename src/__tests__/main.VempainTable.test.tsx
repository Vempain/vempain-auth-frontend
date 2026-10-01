/**
 * @jest-environment jsdom
 */

import {act, render, renderHook, screen, waitFor} from "@testing-library/react";
import type {TableProps} from "antd";
import {jest} from "@jest/globals";
import type {PagedRequest, PagedResponse} from "../models";
import type {VempainColumnsType, VempainTableFilters} from "../main/VempainTable";
import {applyColumnFilters, fetchAllPages, matchesFilterValue, matchesSearchText, splitColumnsForMobile, VempainTable} from "../main/VempainTable";
import {sorterFieldName, toPagedRequest, usePagedTable} from "../main/usePagedTable";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => options === undefined ? key : `${key}:${JSON.stringify(options)}`
    })
}));
jest.mock("@ant-design/icons", () => ({
    SearchOutlined: () => null
}));

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
        matches: false,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
    })
});

interface Row {
    id: number;
    name: string;
    status: "active" | "inactive";
}

function page(content: Row[], total = content.length, pageNumber = 0, last = true): PagedResponse<Row> {
    return {
        content,
        page: pageNumber,
        size: 10,
        total_elements: total,
        total_pages: last ? 1 : 2,
        first: pageNumber === 0,
        last,
        empty: content.length === 0
    };
}

describe("VempainTable helpers", () => {
    it("converts table query values to the Vempain paged contract", () => {
        expect(toPagedRequest({
            page: 1,
            size: 25,
            sortBy: "name",
            direction: "DESC",
            search: "  ada ",
            caseSensitive: true,
            filterColumn: "name"
        })).toEqual({
            page: 1,
            size: 25,
            sort_by: "name",
            direction: "DESC",
            search: "ada",
            case_sensitive: true,
            filter_column: "name"
        });
        expect(toPagedRequest({page: 0, size: 10, search: "  ", caseSensitive: true}))
                .toEqual({page: 0, size: 10, sort_by: undefined, direction: undefined});
    });

    it("supports nested sorter fields and mobile column selection", () => {
        expect(sorterFieldName({field: ["owner", "name"], order: "ascend"})).toBe("owner.name");
        expect(sorterFieldName({columnKey: "created", order: "ascend"})).toBe("created");

        const columns = [
            {title: "Name", dataIndex: "name", key: "name", mobile: true},
            {title: "Status", dataIndex: "status", key: "status"},
            {title: "Actions", key: "row-actions"}
        ];
        const split = splitColumnsForMobile(columns);
        expect(split.visible.map((column) => column.key)).toEqual(["name", "row-actions"]);
        expect(split.collapsed.map((column) => column.key)).toEqual(["status"]);
    });

    it("matches filter and search values and applies hidden-column filters", () => {
        expect(matchesFilterValue(["active", "verified"], "verified")).toBe(true);
        expect(matchesFilterValue(false, "false")).toBe(true);
        expect(matchesSearchText("Ada Lovelace", "ada")).toBe(true);

        const columns: VempainColumnsType<Row> = [{
            dataIndex: "status",
            key: "status",
            onFilter: (value, record) => record.status === value
        }];
        const filters: VempainTableFilters = {status: ["active"]};
        const rows: Row[] = [
            {id: 1, name: "Ada", status: "active"},
            {id: 2, name: "Grace", status: "inactive"}
        ];
        expect(applyColumnFilters(rows, columns, filters)).toHaveLength(1);
    });

    it("collects pages until the endpoint marks the final page", async () => {
        const fetcher = jest.fn<(request: PagedRequest) => Promise<PagedResponse<Row>>>()
                .mockResolvedValueOnce(page([{id: 1, name: "Ada", status: "active"}], 2, 0, false))
                .mockResolvedValueOnce(page([{id: 2, name: "Grace", status: "inactive"}], 2, 1));

        await expect(fetchAllPages(fetcher)).resolves.toEqual({
            rows: [
                {id: 1, name: "Ada", status: "active"},
                {id: 2, name: "Grace", status: "inactive"}
            ],
            truncated: false
        });
        expect(fetcher).toHaveBeenNthCalledWith(1, {page: 0, size: 100});
        expect(fetcher).toHaveBeenNthCalledWith(2, {page: 1, size: 100});
    });
});

describe("usePagedTable and VempainTable", () => {
    it("fetches server pages and maps table changes to requests", async () => {
        const fetcher = jest.fn<(request: PagedRequest) => Promise<PagedResponse<Row>>>()
                .mockResolvedValue(page([{id: 1, name: "Ada", status: "active"}], 20));
        const messageApi = {error: jest.fn(), success: jest.fn(), warning: jest.fn()} as never;
        const {result} = renderHook(() => usePagedTable(fetcher, {defaultSortBy: "name", messageApi}));

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        expect(fetcher).toHaveBeenLastCalledWith({page: 0, size: 10, sort_by: "name", direction: "ASC"});

        act(() => {
            result.current.handleTableChange(
                    {current: 2, pageSize: 10},
                    {name: ["Ada"]},
                    {field: "name", order: "descend"},
                    {currentDataSource: [], action: "sort"}
            );
        });
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
        expect(fetcher).toHaveBeenLastCalledWith({
            page: 0,
            size: 10,
            sort_by: "name",
            direction: "DESC",
            search: "Ada",
            case_sensitive: false,
            filter_column: "name"
        });
    });

    it("renders regular Ant Design table rows", () => {
        const columns: TableProps<Row>["columns"] = [
            {title: "Name", dataIndex: "name", key: "name"}
        ];

        render(<VempainTable<Row> columns={columns} dataSource={[{id: 1, name: "Ada", status: "active"}]} rowKey={"id"}/>);

        expect(screen.getByText("Ada")).toBeTruthy();
    });
});
