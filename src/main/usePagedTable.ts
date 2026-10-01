import {message, type TablePaginationConfig, type TableProps} from "antd";
import type {MessageInstance} from "antd/es/message/interface";
import type {SorterResult} from "antd/es/table/interface";
import {createElement, Fragment, type ReactElement, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {type PagedRequest, type PagedResponse, SortDirectionEnum} from "../models";

/** Page sizes offered by the size changer of every server-paged table. */
export const PAGED_TABLE_PAGE_SIZE_OPTIONS = ["5", "10", "25", "50", "100"];

export type PagedTableFetcher<T> = (request: PagedRequest) => Promise<PagedResponse<T>>;

export interface UsePagedTableOptions {
    /** Column sent as `sort_by` until the user sorts the table; the endpoint default is used when omitted. */
    defaultSortBy?: string;
    /** Direction sent together with `defaultSortBy`. */
    defaultDirection?: SortDirectionEnum;
    /** Rows per page on the first load, 10 by default. */
    defaultPageSize?: number;
    /** Primitive values that select the data (ids, flags); the table refetches when one of them changes. */
    deps?: ReadonlyArray<string | number | boolean | null | undefined>;
    /** Nothing is fetched while false, e.g. when the feature is disabled; the table then stays empty. */
    enabled?: boolean;
    /**
     * Message API of the screen, when it already renders its own `contextHolder`. The hook then reports load errors
     * through it and returns an empty `contextHolder`, so the screen never mounts two Ant Design message holders.
     */
    messageApi?: MessageInstance;
}

export interface PagedTableState<T> {
    dataSource: T[];
    loading: boolean;
    pagination: TablePaginationConfig;
    handleTableChange: NonNullable<TableProps<T>["onChange"]>;
    search: string;
    /** Applies a new search text and returns to the first page. */
    setSearch: (search: string) => void;
    caseSensitive: boolean;
    /** Toggles case-sensitive search and returns to the first page. */
    setCaseSensitive: (caseSensitive: boolean) => void;
    /** The column the current search is restricted to (`filter_column`), if any. */
    filterColumn?: string;
    /**
     * Restricts the search to one column and returns to the first page; an empty search clears the column filter. The
     * backend accepts a single `filter_column`, so setting a filter replaces any previous one. Sorting is untouched.
     */
    setFilter: (filterColumn: string | undefined, search: string) => void;
    /** Fetches the current page again, e.g. after a row was added or deleted. */
    reload: () => void;
    /** True after a failed fetch until the next successful one. */
    error: boolean;
    /** The Ant Design message holder; render it once in the screen so that load errors become visible. */
    contextHolder: ReactElement;
}

interface TableQuery {
    page: number;
    size: number;
    sortBy?: string;
    direction?: SortDirectionEnum;
    search: string;
    caseSensitive: boolean;
    filterColumn?: string;
}

/**
 * Turns an Ant Design sorter into the `sort_by` column name. Array data indexes are joined with dots and the column key
 * is the fallback for columns without a data index.
 */
export function sorterFieldName<T>(sorter: SorterResult<T> | undefined): string | undefined {
    if (sorter === undefined) {
        return undefined;
    }

    if (Array.isArray(sorter.field)) {
        return sorter.field.map(String).join(".");
    }

    if (sorter.field !== undefined && sorter.field !== null) {
        return String(sorter.field);
    }

    return sorter.columnKey === undefined || sorter.columnKey === null ? undefined : String(sorter.columnKey);
}

/**
 * Builds the request for a server-paged endpoint from the table query. The search text is trimmed and omitted when
 * empty, and the case-sensitivity flag only travels together with a search text.
 */
export function toPagedRequest(query: TableQuery): PagedRequest {
    const search = query.search.trim();
    const request: PagedRequest = {
        page: query.page,
        size: query.size,
        sort_by: query.sortBy,
        direction: query.direction
    };

    if (search !== "") {
        request.search = search;
        request.case_sensitive = query.caseSensitive;
        request.filter_column = query.filterColumn;
    }

    return request;
}

/**
 * State and Ant Design table bindings for a server-paged list endpoint. The hook maps the table's `onChange` to a
 * {@link PagedRequest} (0-based page, page size, `sort_by`/`direction` from the sorter, and the selected column
 * filter), fetches the page through `fetcher`, and exposes the page as `dataSource` with a 1-based `pagination`.
 *
 * A failed fetch shows a translated Ant Design message and logs a generic console error only.
 */
export function usePagedTable<T>(fetcher: PagedTableFetcher<T>, options: UsePagedTableOptions = {}): PagedTableState<T> {
    const {t} = useTranslation();
    const [ownMessageApi, ownContextHolder] = message.useMessage();
    const {defaultSortBy, defaultDirection, defaultPageSize = 10, deps = [], enabled = true, messageApi: externalMessageApi} = options;
    const messageApi = externalMessageApi ?? ownMessageApi;
    const contextHolder = externalMessageApi ? createElement(Fragment) : ownContextHolder;
    const [query, setQuery] = useState<TableQuery>({
        page: 0,
        size: defaultPageSize,
        sortBy: defaultSortBy,
        direction: defaultSortBy === undefined ? undefined : defaultDirection ?? SortDirectionEnum.ASC,
        search: "",
        caseSensitive: false
    });
    const [reloadCounter, setReloadCounter] = useState<number>(0);
    const [dataSource, setDataSource] = useState<T[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [error, setError] = useState<boolean>(false);
    const [settledKey, setSettledKey] = useState<string>("");
    const fetcherRef = useRef<PagedTableFetcher<T>>(fetcher);
    const notifyErrorRef = useRef<() => void>(() => undefined);

    const request = useMemo(() => toPagedRequest(query), [query]);
    const depsKey = JSON.stringify(deps);
    const requestKey = JSON.stringify([request, depsKey, reloadCounter]);

    // The fetcher is usually an inline arrow function; keeping the latest one in a ref means callers do not have to
    // memoize it, while the fetch effect only reacts to real query changes.
    useEffect(() => {
        fetcherRef.current = fetcher;
        // `t` and `messageApi` change identity while i18n resources load; reading them through a ref keeps the fetch
        // effect from firing again for the same request.
        notifyErrorRef.current = () => messageApi.error(t("common.table.loadError"));
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let cancelled = false;

        fetcherRef.current(request)
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setDataSource(response.content);
                setTotal(response.total_elements);
                setError(false);
                setSettledKey(requestKey);
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setError(true);
                setSettledKey(requestKey);
                notifyErrorRef.current();
                console.error("Failed to load a page of table data");
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, request, requestKey]);

    const handleTableChange = useCallback<NonNullable<TableProps<T>["onChange"]>>((paginationConfig, filters, sorter) => {
        const primarySorter = Array.isArray(sorter) ? sorter[0] : sorter;
        const sortBy = primarySorter?.order ? sorterFieldName(primarySorter) : undefined;
        const direction = primarySorter?.order === undefined || primarySorter.order === null
            ? undefined
            : primarySorter.order === "ascend" ? SortDirectionEnum.ASC : SortDirectionEnum.DESC;

        setQuery((previous) => {
            const size = paginationConfig.pageSize ?? previous.size;
            const sortChanged = sortBy !== previous.sortBy || direction !== previous.direction;
            const page = size !== previous.size || sortChanged ? 0 : Math.max(0, (paginationConfig.current ?? 1) - 1);

            const filterEntry = Object.entries(filters).find(([, values]) => Array.isArray(values) && values.length > 0);
            const filterColumn = filterEntry?.[0];
            const search = filterEntry?.[1]?.[0];
            return {
                ...previous,
                page,
                size,
                sortBy,
                direction,
                filterColumn,
                search: typeof search === "string" ? search : ""
            };
        });
    }, []);

    const setSearch = useCallback((search: string) => {
        setQuery((previous) => ({...previous, page: 0, search}));
    }, []);

    const setCaseSensitive = useCallback((caseSensitive: boolean) => {
        setQuery((previous) => ({...previous, page: 0, caseSensitive}));
    }, []);

    const setFilter = useCallback((filterColumn: string | undefined, search: string) => {
        const trimmed = search.trim();
        setQuery((previous) => ({...previous, page: 0, filterColumn: trimmed === "" ? undefined : filterColumn, search: trimmed === "" ? "" : search}));
    }, []);

    const reload = useCallback(() => {
        setReloadCounter((previous) => previous + 1);
    }, []);

    const pagination = useMemo<TablePaginationConfig>(() => ({
        current: query.page + 1,
        pageSize: query.size,
        total,
        showSizeChanger: true,
        pageSizeOptions: PAGED_TABLE_PAGE_SIZE_OPTIONS,
        showTotal: (totalCount, range) => t("common.table.pagination.total", {from: range[0], to: range[1], total: totalCount})
    }), [query.page, query.size, t, total]);

    return {
        dataSource,
        loading: enabled && settledKey !== requestKey,
        pagination,
        handleTableChange,
        search: query.search,
        setSearch,
        caseSensitive: query.caseSensitive,
        setCaseSensitive,
        filterColumn: query.filterColumn,
        setFilter,
        reload,
        error,
        contextHolder
    };
}
