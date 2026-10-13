/**
 * @jest-environment jsdom
 */

import {act, renderHook, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import type {PagedRequest, PagedResponse} from "../models";
import {sorterFieldName, usePagedTable} from "../main/usePagedTable";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => options === undefined ? key : `${key}:${JSON.stringify(options)}`
    })
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

interface Row {
    id: number;
    name: string;
}

type Fetcher = (request: PagedRequest) => Promise<PagedResponse<Row>>;

function page(content: Row[], total = content.length): PagedResponse<Row> {
    return {content, page: 0, size: 10, total_elements: total, total_pages: 1, first: true, last: true, empty: content.length === 0};
}

const rows = [{id: 1, name: "Ada"}];

describe("sorterFieldName", () => {
    it("handles missing sorters and sorters without field or key", () => {
        expect(sorterFieldName(undefined)).toBeUndefined();
        expect(sorterFieldName({field: null as never, columnKey: null as never})).toBeUndefined();
        expect(sorterFieldName({})).toBeUndefined();
        expect(sorterFieldName({field: 3})).toBe("3");
    });
});

describe("usePagedTable", () => {
    let errorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("reports a failed load and recovers on reload", async () => {
        const fetcher = jest.fn<Fetcher>().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(page(rows));
        const messageApi = {error: jest.fn(), success: jest.fn(), warning: jest.fn()} as never;
        const {result} = renderHook(() => usePagedTable(fetcher, {messageApi}));

        await waitFor(() => expect(result.current.error).toBe(true));
        expect(result.current.loading).toBe(false);
        expect(errorSpy).toHaveBeenCalledWith("Failed to load a page of table data");
        expect((messageApi as { error: jest.Mock }).error).toHaveBeenCalledWith("common.table.loadError");

        act(() => result.current.reload());

        await waitFor(() => expect(result.current.error).toBe(false));
        expect(result.current.dataSource).toEqual(rows);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("uses its own message holder when the screen has none", async () => {
        const fetcher = jest.fn<Fetcher>().mockRejectedValue(new Error("down"));
        const {result} = renderHook(() => usePagedTable(fetcher));

        await waitFor(() => expect(result.current.error).toBe(true));
        expect(result.current.contextHolder).toBeTruthy();
    });

    it("maps search, case sensitivity and column filters to the request and returns to the first page", async () => {
        const fetcher = jest.fn<Fetcher>().mockResolvedValue(page(rows, 50));
        const messageApi = {error: jest.fn(), success: jest.fn(), warning: jest.fn()} as never;
        const {result} = renderHook(() => usePagedTable(fetcher, {messageApi, defaultPageSize: 5}));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        expect(fetcher).toHaveBeenLastCalledWith({page: 0, size: 5, sort_by: undefined, direction: undefined});

        act(() => result.current.handleTableChange({current: 3, pageSize: 5}, {}, {}, {currentDataSource: [], action: "paginate"}));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
        expect(fetcher).toHaveBeenLastCalledWith({page: 2, size: 5, sort_by: undefined, direction: undefined});
        expect(result.current.pagination.current).toBe(3);

        act(() => result.current.setSearch("ada"));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
        expect(fetcher).toHaveBeenLastCalledWith({
            page: 0,
            size: 5,
            sort_by: undefined,
            direction: undefined,
            search: "ada",
            case_sensitive: false,
            filter_column: undefined
        });
        expect(result.current.search).toBe("ada");

        act(() => result.current.setCaseSensitive(true));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
        expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({search: "ada", case_sensitive: true}));
        expect(result.current.caseSensitive).toBe(true);

        act(() => result.current.setFilter("name", "Ad"));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
        expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({search: "Ad", filter_column: "name"}));
        expect(result.current.filterColumn).toBe("name");

        act(() => result.current.setFilter("name", "  "));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(6));
        expect(fetcher).toHaveBeenLastCalledWith({page: 0, size: 5, sort_by: undefined, direction: undefined});
        expect(result.current.filterColumn).toBeUndefined();
        expect(result.current.search).toBe("");
    });

    it("handles sorter arrays, cleared sorting and page size changes", async () => {
        const fetcher = jest.fn<Fetcher>().mockResolvedValue(page(rows, 50));
        const messageApi = {error: jest.fn(), success: jest.fn(), warning: jest.fn()} as never;
        const {result} = renderHook(() => usePagedTable(fetcher, {messageApi, defaultSortBy: "name", defaultDirection: "DESC"}));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        expect(fetcher).toHaveBeenLastCalledWith({page: 0, size: 10, sort_by: "name", direction: "DESC"});

        act(() => result.current.handleTableChange({current: 2, pageSize: 10}, {}, [{field: "id", order: "ascend"}], {currentDataSource: [], action: "sort"}));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
        expect(fetcher).toHaveBeenLastCalledWith({page: 0, size: 10, sort_by: "id", direction: "ASC"});

        act(() => result.current.handleTableChange({current: 2, pageSize: 10}, {}, {field: "id", order: null}, {currentDataSource: [], action: "sort"}));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
        expect(fetcher).toHaveBeenLastCalledWith({page: 0, size: 10, sort_by: undefined, direction: undefined});

        act(() => result.current.handleTableChange({current: 2}, {}, {}, {currentDataSource: [], action: "paginate"}));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
        expect(fetcher).toHaveBeenLastCalledWith({page: 1, size: 10, sort_by: undefined, direction: undefined});

        act(() => result.current.handleTableChange({current: 2, pageSize: 25}, {}, {}, {currentDataSource: [], action: "paginate"}));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
        expect(fetcher).toHaveBeenLastCalledWith({page: 0, size: 25, sort_by: undefined, direction: undefined});
        expect(result.current.pagination.pageSize).toBe(25);
    });

    it("fetches nothing while disabled and refetches when a dependency changes", async () => {
        const fetcher = jest.fn<Fetcher>().mockResolvedValue(page(rows));
        const messageApi = {error: jest.fn(), success: jest.fn(), warning: jest.fn()} as never;
        const {result, rerender} = renderHook(({enabled, owner}: { enabled: boolean; owner: number }) =>
                usePagedTable(fetcher, {messageApi, enabled, deps: [owner]}), {initialProps: {enabled: false, owner: 1}});

        expect(result.current.loading).toBe(false);
        expect(fetcher).not.toHaveBeenCalled();

        rerender({enabled: true, owner: 1});
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(result.current.loading).toBe(false));

        rerender({enabled: true, owner: 2});
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    });

    it("describes the visible range through the translated total", async () => {
        const fetcher = jest.fn<Fetcher>().mockResolvedValue(page(rows, 20));
        const messageApi = {error: jest.fn(), success: jest.fn(), warning: jest.fn()} as never;
        const {result} = renderHook(() => usePagedTable(fetcher, {messageApi}));
        await waitFor(() => expect(result.current.pagination.total).toBe(20));

        expect(result.current.pagination.showTotal?.(20, [1, 10])).toBe('common.table.pagination.total:{"from":1,"to":10,"total":20}');
        expect(result.current.pagination.pageSizeOptions).toEqual(["5", "10", "25", "50", "100"]);
    });
});
