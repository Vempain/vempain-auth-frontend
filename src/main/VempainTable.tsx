import {Button, Descriptions, Grid, Input, message, Select, Table, type TableProps} from "antd";
import {SearchOutlined} from "@ant-design/icons";
import type {MessageInstance} from "antd/es/message/interface";
import type {ColumnGroupType, ColumnsType, ColumnType} from "antd/es/table";
import type {FilterDropdownProps, FilterValue} from "antd/es/table/interface";
import type {Breakpoint} from "antd/es/_util/responsiveObserver";
import {type Key, type ReactNode, type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import type {TFunction} from "i18next";
import type {PagedRequest, PagedResponse} from "../models";
import type {PagedTableState} from "./usePagedTable";

/**
 * A column of an VempainTable. In addition to the Ant Design column properties a column can be flagged as `mobile`, which
 * means that it identifies the row and therefore stays visible when the table collapses on a narrow screen. Columns
 * without the flag are moved into the expandable row on narrow screens. Action columns (key or dataIndex `action` or
 * `actions`) always stay visible.
 *
 * `searchable` controls the free-text column search. Data columns are searchable by default in both modes; set it to
 * `false` for columns that the backend cannot search. Enum filters (`filters`) are independent of the flag.
 */
export type VempainColumnType<RecordType> = ColumnType<RecordType> & { mobile?: boolean; searchable?: boolean };
export type VempainColumnGroupType<RecordType> = ColumnGroupType<RecordType> & { mobile?: boolean; searchable?: boolean };
export type VempainColumnsType<RecordType> = (VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>)[];

/** Where the rows are filtered, sorted and paged: in the browser (`client`) or by the backend (`server`). */
export type VempainTableDataMode = "client" | "server";

/** Page size used when a client-mode table collects every row of a paged endpoint. */
export const CLIENT_PAGE_SIZE = 100;
/** Upper bound of pages a client-mode table walks through; the walk stops and warns when it is reached. */
export const CLIENT_FETCH_MAX_PAGES = 50;

export type VempainTableFetcher<RecordType> = (request: PagedRequest) => Promise<PagedResponse<RecordType>>;

/** Imperative handle of an VempainTable; `reload` fetches the rows again in client mode with a `fetcher` and in server mode. */
export interface VempainTableHandle {
    reload: () => void;
}

export type VempainTableFilters = Record<string, FilterValue | null>;

export interface VempainTableProps<RecordType> extends Omit<TableProps<RecordType>, "columns" | "ref"> {
    columns?: VempainColumnsType<RecordType>;
    /** The table collapses when the viewport is narrower than this Ant Design breakpoint. Defaults to `md` (768px). */
    collapseBelow?: Breakpoint;
    /**
     * `client` (default): the rows come from `dataSource`, or from `fetcher` which is walked page by page with
     * {@link CLIENT_PAGE_SIZE} until the last page; filtering, sorting and paging happen in the browser.
     * `server`: the rows come from `paged` (a `usePagedTable` state) and every filter, sort and page change is sent to
     * the backend. The backend accepts one column filter at a time, so a new filter replaces the previous one.
     */
    dataMode?: VempainTableDataMode;
    /** Client mode: loads every row of a paged endpoint; `dataSource` is ignored while a fetcher is given. */
    fetcher?: VempainTableFetcher<RecordType>;
    /** Client mode: primitive values that select the data (ids, flags); the rows are fetched again when one changes. */
    fetchDeps?: ReadonlyArray<string | number | boolean | null | undefined>;
    /** Client mode: nothing is fetched while false; the table then stays empty. Defaults to true. */
    fetchEnabled?: boolean;
    /** Client mode: changing the token fetches the rows again, e.g. after a row was added. */
    reloadToken?: string | number;
    /**
     * Client mode: the message API of the screen, when it already renders its own `contextHolder`. Load errors are then
     * reported through it and the table renders no message holder of its own.
     */
    messageApi?: MessageInstance;
    /** Server mode: the state of `usePagedTable`; supplies `dataSource`, `loading`, `pagination` and `onChange`. */
    paged?: PagedTableState<RecordType>;
    ref?: Ref<VempainTableHandle>;
}

/** Matches `action`, `actions` and suffixed variants such as `comment-list-action` or `row_actions`. */
const ACTION_COLUMN_PATTERN = /(^|[-_.])actions?$/;

function columnIdentity<RecordType>(column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>): string {
    const key = column.key ?? ("dataIndex" in column ? column.dataIndex : undefined);

    if (Array.isArray(key)) {
        return key.join(".");
    }

    return key === undefined || key === null ? "" : String(key);
}

export function isActionColumn<RecordType>(column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>): boolean {
    return ACTION_COLUMN_PATTERN.test(columnIdentity(column).toLowerCase());
}

/**
 * Splits the columns into the ones that stay visible on a narrow screen and the ones that move into the expanded row.
 * When no column is flagged as `mobile`, the first non-action column is used as the identifying column so that the
 * table never collapses to only its action buttons.
 */
export function splitColumnsForMobile<RecordType>(columns: VempainColumnsType<RecordType>): {
    visible: VempainColumnsType<RecordType>;
    collapsed: VempainColumnsType<RecordType>;
} {
    const hasMobileColumn = columns.some((column) => column.mobile);
    const fallbackIdentifier = hasMobileColumn ? undefined : columns.find((column) => !isActionColumn(column));
    const visible: VempainColumnsType<RecordType> = [];
    const collapsed: VempainColumnsType<RecordType> = [];

    for (const column of columns) {
        if (column.mobile || isActionColumn(column) || column === fallbackIdentifier) {
            visible.push(column);
        } else {
            collapsed.push(column);
        }
    }

    return {visible, collapsed};
}

function readDataIndex<RecordType>(record: RecordType, dataIndex: unknown): unknown {
    if (dataIndex === undefined || dataIndex === null) {
        return undefined;
    }

    const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex];
    let value: unknown = record;

    for (const segment of path) {
        if (value === null || value === undefined) {
            return undefined;
        }

        value = (value as Record<string, unknown>)[String(segment)];
    }

    return value;
}

function columnLabel<RecordType>(column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>): ReactNode {
    const title = column.title;

    if (typeof title === "function") {
        return title({sortColumns: [], filters: {}});
    }

    return title ?? columnIdentity(column);
}

/** The plain-text name of a column for placeholders and labels: its title when that is a string, its identity otherwise. */
function columnName<RecordType>(column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>): string {
    const title = column.title;
    return typeof title === "string" || typeof title === "number" ? String(title) : columnIdentity(column);
}

function isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || value === "";
}

/** Milliseconds of a `Date`, a Dayjs instance or any other object whose `valueOf()` is a number. */
function temporalValue(value: unknown): number | undefined {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }

    const primitive = (value as { valueOf: () => unknown }).valueOf();
    return typeof primitive === "number" ? primitive : undefined;
}

/**
 * Default client-side filter for a column with `filters`: the cell equals the filter value, or contains it when the
 * cell is an array. Booleans and numbers are compared through `String()` so that `"true"` and `true` match.
 */
export function matchesFilterValue(cell: unknown, value: Key | boolean): boolean {
    if (Array.isArray(cell)) {
        return cell.some((item) => String(item) === String(value));
    }

    return !isEmptyValue(cell) && String(cell) === String(value);
}

/** Default client-side filter for a free-text column search: a case-insensitive substring match. */
export function matchesSearchText(cell: unknown, value: Key | boolean): boolean {
    if (isEmptyValue(cell)) {
        return false;
    }

    return String(cell).toLowerCase().includes(String(value).toLowerCase());
}

/**
 * Default comparator for `sorter: true` in client mode: numbers numerically, dates (`Date`, Dayjs) by their
 * timestamp, everything else as strings with `localeCompare`; empty values sort last in ascending order.
 */
export function compareCellValues(a: unknown, b: unknown): number {
    const aEmpty = isEmptyValue(a);
    const bEmpty = isEmptyValue(b);

    if (aEmpty || bEmpty) {
        return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
    }

    if (typeof a === "number" && typeof b === "number") {
        return a - b;
    }

    if (typeof a === "boolean" && typeof b === "boolean") {
        return Number(a) - Number(b);
    }

    const aTime = temporalValue(a);
    const bTime = temporalValue(b);

    if (aTime !== undefined && bTime !== undefined) {
        return aTime - bTime;
    }

    return String(a).localeCompare(String(b), undefined, {numeric: true, sensitivity: "base"});
}

function hasFilterValue(value: FilterValue | null | undefined): value is FilterValue {
    return Array.isArray(value) && value.length > 0;
}

/**
 * Applies the active filters of columns the Ant Design Table does not render (the columns collapsed into the mobile
 * row) with the same semantics as the table: a row passes a column when any selected value matches its `onFilter`,
 * and it must pass every filtered column.
 */
export function applyColumnFilters<RecordType>(rows: readonly RecordType[], columns: VempainColumnsType<RecordType>, filters: VempainTableFilters): RecordType[] {
    const active = columns.flatMap((column) => {
        const values = column.filteredValue ?? filters[columnIdentity(column)];
        const onFilter = "onFilter" in column ? column.onFilter : undefined;
        return hasFilterValue(values) && onFilter ? [{values, onFilter}] : [];
    });

    if (active.length === 0) {
        return [...rows];
    }

    return rows.filter((row) => active.every(({values, onFilter}) => values.some((value) => onFilter(value, row))));
}

/**
 * Keeps at most one column filter, as the backend accepts a single `filter_column`. The filter that changed compared
 * with the previous state wins; otherwise the first remaining filter is kept.
 */
export function reduceToSingleFilter(previous: VempainTableFilters, next: VempainTableFilters): VempainTableFilters {
    const active = Object.entries(next).filter(([, value]) => hasFilterValue(value));
    const changed = active.find(([column, value]) => JSON.stringify(previous[column] ?? null) !== JSON.stringify(value));
    const winner = changed ?? active[0];

    return winner ? {[winner[0]]: winner[1]} : {};
}

/**
 * Collects every row of a paged endpoint with {@link CLIENT_PAGE_SIZE} rows per request, stopping at the last page.
 * The walk is capped at `maxPages`; when the cap is hit the rows collected so far are returned as `truncated`.
 */
export async function fetchAllPages<RecordType>(fetcher: VempainTableFetcher<RecordType>, maxPages: number = CLIENT_FETCH_MAX_PAGES): Promise<{
    rows: RecordType[];
    truncated: boolean;
}> {
    const rows: RecordType[] = [];
    let page = 0;

    for (; ;) {
        const response = await fetcher({page, size: CLIENT_PAGE_SIZE});
        rows.push(...response.content);

        if (response.last || response.content.length === 0) {
            return {rows, truncated: false};
        }

        page++;

        if (page >= maxPages) {
            console.warn("Table data fetch stopped at the page limit");
            return {rows, truncated: true};
        }
    }
}

/**
 * Renders a single cell the same way the table would, so that tags, links and formatted values look identical in the
 * collapsed view. Cells that render as `{children, props}` objects are unwrapped.
 */
export function renderCollapsedValue<RecordType>(
        column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>,
        record: RecordType,
        index: number
): ReactNode {
    const rawValue = "dataIndex" in column ? readDataIndex(record, column.dataIndex) : undefined;
    const render = "render" in column ? column.render : undefined;
    const rendered = render ? render(rawValue, record, index) : rawValue;

    if (rendered !== null && typeof rendered === "object" && !Array.isArray(rendered) && "children" in (rendered as object)
            && !("$$typeof" in (rendered as object))) {
        return (rendered as { children?: ReactNode }).children ?? null;
    }

    if (rendered === undefined || rendered === null || typeof rendered === "boolean") {
        return typeof rendered === "boolean" ? String(rendered) : "";
    }

    return rendered as ReactNode;
}

/**
 * Whether the current viewport is narrower than the given breakpoint. The breakpoint map is empty on the very first
 * render, and all false in jsdom, and both must be treated as a wide screen so that nothing collapses by accident.
 */
export function isNarrowScreen(screens: Partial<Record<Breakpoint, boolean>>, collapseBelow: Breakpoint): boolean {
    const anyBreakpointMatched = Object.values(screens).some((matched) => matched === true);
    return anyBreakpointMatched && screens[collapseBelow] === false;
}

function isDataColumn<RecordType>(column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>): column is VempainColumnType<RecordType> {
    return !isActionColumn(column) && !("children" in column) && "dataIndex" in column && column.dataIndex !== undefined && column.dataIndex !== null;
}

export type VempainColumnFilterKind = "enum" | "text";

/**
 * Which filter a column offers: a Select over its `filters`, a free-text search, or none. The text search is enabled
 * by default and can be disabled with `searchable: false`.
 */
export function columnFilterKind<RecordType>(
        column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>
): VempainColumnFilterKind | undefined {
    if (!isDataColumn(column)) {
        return undefined;
    }

    if (column.filters) {
        return "enum";
    }

    if (column.searchable !== false) {
        return "text";
    }

    return undefined;
}

interface ColumnEnhancement {
    serverMode: boolean;
    filters: VempainTableFilters;
    t: TFunction;
}

/**
 * Adds the VempainTable behaviour to a column: a controlled `filteredValue`, a filter dropdown (a Select for enum columns
 * with `filters`, a text input otherwise) and, in client mode, default `onFilter` and `sorter` implementations. In
 * server mode the column never filters or sorts locally.
 */
function enhanceColumn<RecordType>(
        column: VempainColumnType<RecordType> | VempainColumnGroupType<RecordType>,
        {serverMode, filters, t}: ColumnEnhancement
): VempainColumnType<RecordType> | VempainColumnGroupType<RecordType> {
    if (!isDataColumn(column)) {
        return column;
    }

    const identity = columnIdentity(column);
    const name = columnName(column);
    const filterKind = columnFilterKind(column);
    const defaultSorter: VempainColumnType<RecordType>["sorter"] = (a, b) =>
            compareCellValues(readDataIndex(a, column.dataIndex), readDataIndex(b, column.dataIndex));

    if (filterKind === undefined) {
        return {
            ...column,
            key: column.key ?? identity,
            onFilter: serverMode ? undefined : column.onFilter,
            sorter: !serverMode && column.sorter === true ? defaultSorter : column.sorter
        };
    }

    const enumOptions = column.filters?.map((filter) => ({label: filter.text, value: filter.value}));

    const textDropdown = ({selectedKeys, setSelectedKeys, confirm, clearFilters}: FilterDropdownProps) => (
            <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                <Input
                        autoFocus
                        placeholder={t("common.table.filter.searchColumn", {column: name})}
                        value={selectedKeys[0] as string | undefined}
                        onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{width: 188, marginBottom: 8, display: "block"}}
                />
                <Button size={"small"} onClick={() => {
                    clearFilters?.();
                    confirm();
                }}>{t("common.table.filter.reset")}</Button>
            </div>
    );

    const enumDropdown = enumOptions ? ({selectedKeys, setSelectedKeys, confirm, clearFilters}: FilterDropdownProps) => (
            <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                <Select
                        allowClear
                        autoFocus
                        placeholder={t("common.table.filter.select")}
                        aria-label={t("common.table.filter.searchColumn", {column: name})}
                        value={selectedKeys[0]}
                        options={enumOptions}
                        onChange={(value) => {
                            setSelectedKeys(value === undefined || value === null ? [] : [value as Key]);
                            confirm();
                        }}
                        style={{width: 188, marginBottom: 8, display: "block"}}
                />
                <Button size={"small"} onClick={() => {
                    clearFilters?.();
                    confirm();
                }}>{t("common.table.filter.reset")}</Button>
            </div>
    ) : undefined;

    const defaultOnFilter: VempainColumnType<RecordType>["onFilter"] = enumOptions
            ? (value, record) => matchesFilterValue(readDataIndex(record, column.dataIndex), value)
            : (value, record) => matchesSearchText(readDataIndex(record, column.dataIndex), value);

    return {
        ...column,
        key: column.key ?? identity,
        filteredValue: column.filteredValue ?? filters[identity] ?? null,
        onFilter: serverMode ? undefined : column.onFilter ?? defaultOnFilter,
        sorter: !serverMode && column.sorter === true ? defaultSorter : column.sorter,
        filterDropdown: column.filterDropdown ?? enumDropdown ?? textDropdown,
        filterIcon: column.filterIcon ?? ((filtered: boolean) => <SearchOutlined style={filtered ? {color: "#1677ff"} : undefined}/>)
    };
}

interface ClientRowsOptions {
    deps: ReadonlyArray<string | number | boolean | null | undefined>;
    enabled: boolean;
    reloadToken?: string | number;
    messageApi?: MessageInstance;
}

/** Loads every row of a paged endpoint for a client-mode table and reports failures with a translated message. */
function useClientRows<RecordType>(fetcher: VempainTableFetcher<RecordType>, {deps, enabled, reloadToken, messageApi: externalMessageApi}: ClientRowsOptions) {
    const {t} = useTranslation();
    const [ownMessageApi, ownContextHolder] = message.useMessage();
    const messageApi = externalMessageApi ?? ownMessageApi;
    const contextHolder = externalMessageApi ? null : ownContextHolder;
    const [rows, setRows] = useState<RecordType[]>([]);
    const [reloadCounter, setReloadCounter] = useState<number>(0);
    const [settledKey, setSettledKey] = useState<string>("");
    const fetcherRef = useRef<VempainTableFetcher<RecordType>>(fetcher);
    const notifyRef = useRef<{ error: () => void; limit: (rowCount: number) => void }>({error: () => undefined, limit: () => undefined});
    const requestKey = JSON.stringify([deps, reloadToken, reloadCounter]);

    // The fetcher is usually an inline arrow function and `t`/`messageApi` change identity while i18n loads; reading
    // them through refs keeps the fetch effect from firing again for the same request.
    useEffect(() => {
        fetcherRef.current = fetcher;
        notifyRef.current = {
            error: () => messageApi.error(t("common.table.loadError")),
            limit: (rowCount) => messageApi.warning(t("common.table.fetchLimitReached", {rows: rowCount}))
        };
    });

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let cancelled = false;

        fetchAllPages(fetcherRef.current)
                .then(({rows: loadedRows, truncated}) => {
                    if (cancelled) {
                        return;
                    }

                    setRows(loadedRows);
                    setSettledKey(requestKey);

                    if (truncated) {
                        notifyRef.current.limit(loadedRows.length);
                    }
                })
                .catch(() => {
                    if (cancelled) {
                        return;
                    }

                    setSettledKey(requestKey);
                    notifyRef.current.error();
                    console.error("Failed to load table data");
                });

        return () => {
            cancelled = true;
        };
    }, [enabled, requestKey]);

    const reload = useCallback(() => {
        setReloadCounter((previous) => previous + 1);
    }, []);

    return {rows, loading: enabled && settledKey !== requestKey, reload, contextHolder};
}

interface VempainTableViewProps<RecordType> extends Omit<VempainTableProps<RecordType>, "fetcher" | "fetchDeps" | "fetchEnabled" | "reloadToken" | "messageApi"> {
    reload: () => void;
}

/**
 * The table itself. It owns the column filter state so that the header dropdowns and the search inside a collapsed
 * mobile row drive the same filters, and it adapts to narrow screens: below the collapse breakpoint only the columns
 * flagged as `mobile`, plus the action column, remain visible; every other column is listed inside the expandable row,
 * above any expanded content the caller provides.
 */
function VempainTableView<RecordType extends object>(props: VempainTableViewProps<RecordType>) {
    const {columns = [], collapseBelow = "md", dataMode = "client", paged, reload, ref, expandable, size, loading, onChange, ...tableProps} = props;
    const {t} = useTranslation();
    const screens = Grid.useBreakpoint();
    const narrow = isNarrowScreen(screens, collapseBelow);
    const serverMode = dataMode === "server" && paged !== undefined;
    const [filters, setFilters] = useState<VempainTableFilters>({});
    const [mobileSearch, setMobileSearch] = useState<string>();

    useImperativeHandle(ref, () => ({reload}), [reload]);

    const enhancedColumns = useMemo(() => columns.map((column) => enhanceColumn(column, {serverMode, filters, t})), [columns, filters, serverMode, t]);

    const handleChange: NonNullable<TableProps<RecordType>["onChange"]> = (paginationConfig, nextFilters, sorter, extra) => {
        const effectiveFilters = serverMode ? reduceToSingleFilter(filters, nextFilters) : nextFilters;
        setFilters(effectiveFilters);

        if (serverMode) {
            paged.handleTableChange(paginationConfig, effectiveFilters, sorter, extra);
        }

        onChange?.(paginationConfig, effectiveFilters, sorter, extra);
    };

    /** Applies a filter chosen inside a collapsed mobile row; in server mode it replaces the previous column filter. */
    const applyMobileFilter = (columnId: string, value: string) => {
        const filterValue: FilterValue | null = value ? [value] : null;

        if (serverMode) {
            setFilters(filterValue ? {[columnId]: filterValue} : {});
            paged.setFilter(filterValue ? columnId : undefined, value);
        } else {
            setFilters((previous) => ({...previous, [columnId]: filterValue}));
        }

        setMobileSearch(undefined);
    };

    const dataProps: Pick<TableProps<RecordType>, "dataSource" | "loading" | "pagination" | "onChange"> = serverMode
            ? {
                dataSource: paged.dataSource,
                loading: paged.loading ? true : loading,
                pagination: paged.pagination,
                onChange: handleChange
            }
            : {
                dataSource: tableProps.dataSource,
                loading,
                pagination: tableProps.pagination,
                onChange: handleChange
            };

    if (!narrow) {
        return <Table<RecordType> {...tableProps} {...dataProps} columns={enhancedColumns as ColumnsType<RecordType>} expandable={expandable} size={size}/>;
    }

    const {visible, collapsed} = splitColumnsForMobile(enhancedColumns);

    if (collapsed.length === 0) {
        return <Table<RecordType> {...tableProps} {...dataProps} columns={visible as ColumnsType<RecordType>} expandable={expandable} size={size ?? "small"}/>;
    }

    // The table only filters the columns it renders, so the filters of the collapsed columns are applied here in
    // client mode; in server mode the backend has already applied them.
    const narrowDataProps = serverMode || !dataProps.dataSource
            ? dataProps
            : {...dataProps, dataSource: applyColumnFilters(dataProps.dataSource, collapsed, filters)};

    const originalExpandedRowRender = expandable?.expandedRowRender;
    const originalRowExpandable = expandable?.rowExpandable;

    const mobileExpandable: NonNullable<TableProps<RecordType>["expandable"]> = {
        ...expandable,
        rowExpandable: () => true,
        expandedRowRender: (record, index, indent, expanded) => (
                <div className={"vempain-table-collapsed-row"}>
                    <Descriptions
                            size={"small"}
                            column={1}
                            colon
                            items={collapsed.map((column, columnIndex) => ({
                                key: columnIdentity(column) || String(columnIndex),
                                label: (
                                        <span>
                                {columnLabel(column)}
                                            {columnFilterKind(column) !== undefined && (
                                                    <button
                                                            type="button"
                                                            aria-label={t("common.table.filter.searchColumn", {column: columnName(column)})}
                                                            onClick={() => setMobileSearch(columnIdentity(column))}
                                                            style={{border: 0, background: "transparent", cursor: "pointer", marginLeft: 6}}
                                                    >
                                                        <SearchOutlined
                                                                style={hasFilterValue(filters[columnIdentity(column)]) ? {color: "#1677ff"} : undefined}/>
                                                    </button>
                                            )}
                            </span>
                                ),
                                children: renderCollapsedValue(column, record, index)
                            }))}
                    />
                    {mobileSearch && (() => {
                        const selectedColumn = collapsed.find((column) => columnIdentity(column) === mobileSearch);

                        if (!selectedColumn || !isDataColumn(selectedColumn) || columnFilterKind(selectedColumn) === undefined) {
                            return null;
                        }

                        const currentValue = filters[mobileSearch]?.[0];
                        const enumFilters = selectedColumn.filters;
                        const name = columnName(selectedColumn);

                        return enumFilters ? (
                                <Select
                                        autoFocus
                                        allowClear
                                        placeholder={t("common.table.filter.select")}
                                        aria-label={t("common.table.filter.searchColumn", {column: name})}
                                        defaultValue={currentValue === undefined ? undefined : String(currentValue)}
                                        options={enumFilters.map((filter) => ({label: filter.text, value: filter.value}))}
                                        onChange={(value) => applyMobileFilter(mobileSearch, value === undefined || value === null ? "" : String(value))}
                                        style={{marginTop: 8, width: "100%"}}
                                />
                        ) : (
                                <Input.Search
                                        autoFocus
                                        allowClear
                                        defaultValue={currentValue === undefined ? String(readDataIndex(record, selectedColumn.dataIndex) ?? "") : String(currentValue)}
                                        placeholder={t("common.table.filter.searchColumn", {column: name})}
                                        aria-label={t("common.table.filter.searchColumn", {column: name})}
                                        onSearch={(value) => applyMobileFilter(mobileSearch, value)}
                                        onBlur={() => setMobileSearch(undefined)}
                                        style={{marginTop: 8}}
                                />
                        );
                    })()}
                    {originalExpandedRowRender && (originalRowExpandable === undefined || originalRowExpandable(record))
                            && originalExpandedRowRender(record, index, indent, expanded)}
                </div>
        )
    };

    return (
            <Table<RecordType>
                    {...tableProps}
                    {...narrowDataProps}
                    columns={visible as ColumnsType<RecordType>}
                    expandable={mobileExpandable}
                    size={size ?? "small"}
                    tableLayout={tableProps.tableLayout ?? "auto"}
            />
    );
}

/** Client-mode table that loads all of its rows from a paged endpoint. */
function VempainFetchedTable<RecordType extends object>(props: Omit<VempainTableProps<RecordType>, "fetcher"> & { fetcher: VempainTableFetcher<RecordType> }) {
    const {fetcher, fetchDeps = [], fetchEnabled = true, reloadToken, messageApi, loading, ...viewProps} = props;
    const {rows, loading: fetching, reload, contextHolder} = useClientRows(fetcher, {deps: fetchDeps, enabled: fetchEnabled, reloadToken, messageApi});

    return (
            <>
                {contextHolder}
                <VempainTableView<RecordType> {...viewProps} dataSource={rows} loading={fetching ? true : loading} reload={reload}/>
            </>
    );
}

const noReload = () => undefined;

/**
 * Ant Design Table that adapts to narrow screens and knows where its data is processed (`dataMode`, see
 * {@link VempainTableProps}). On wide screens it behaves like the Ant Design Table; below the collapse breakpoint only the
 * columns flagged as `mobile`, plus the action column, remain visible and every other column is listed inside the
 * expandable row. Column filters (enum `filters` or a free-text search) work in every mode and layout.
 */
export function VempainTable<RecordType extends object = Record<string, unknown>>(props: VempainTableProps<RecordType>) {
    const {dataMode = "client", fetcher, fetchDeps, fetchEnabled, reloadToken, messageApi, paged, ...viewProps} = props;
    const missingPagedState = dataMode === "server" && paged === undefined;

    useEffect(() => {
        if (missingPagedState) {
            console.error("VempainTable in server mode needs the `paged` state of usePagedTable");
        }
    }, [missingPagedState]);

    if (dataMode === "server") {
        return <VempainTableView<RecordType> {...viewProps} dataMode={paged ? "server" : "client"} paged={paged} reload={paged?.reload ?? noReload}/>;
    }

    if (fetcher) {
        return (
                <VempainFetchedTable<RecordType>
                        {...viewProps}
                        fetcher={fetcher}
                        fetchDeps={fetchDeps}
                        fetchEnabled={fetchEnabled}
                        reloadToken={reloadToken}
                        messageApi={messageApi}
                />
        );
    }

    return <VempainTableView<RecordType> {...viewProps} dataMode={"client"} reload={noReload}/>;
}
