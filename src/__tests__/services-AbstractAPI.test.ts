/**
 * @jest-environment jsdom
 */

import {jest} from "@jest/globals";
import {VEMPAIN_LOCAL_STORAGE_KEY} from "../models";

type Call = (...args: unknown[]) => Promise<{ status: number; data: unknown }>;

const axiosInstance = {
    defaults: {headers: {common: {} as Record<string, string>, get: {}, post: {}, put: {} as Record<string, string>, delete: {}}},
    get: jest.fn<Call>(),
    post: jest.fn<Call>(),
    put: jest.fn<Call>(),
    delete: jest.fn<Call>(),
    interceptors: {request: {use: jest.fn(), eject: jest.fn()}, response: {use: jest.fn(), eject: jest.fn()}}
};
const create = jest.fn(() => axiosInstance);

jest.mock("axios", () => ({
    __esModule: true,
    default: {create: (...args: unknown[]) => create(...args as [])}
}));

interface Item {
    id: number;
    name: string;
}

async function itemAPI() {
    const {AbstractAPI} = await import("../services/AbstractAPI");

    class ItemAPI extends AbstractAPI<Item, Item> {
    }

    return new ItemAPI("http://backend/api", "/items");
}

describe("AbstractAPI", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        axiosInstance.defaults.headers.common = {};
        axiosInstance.defaults.headers.put = {};
        for (const method of [axiosInstance.get, axiosInstance.post, axiosInstance.put, axiosInstance.delete]) {
            method.mockReset();
        }
        axiosInstance.interceptors.response.use.mockClear();
        axiosInstance.interceptors.request.use.mockClear();
        create.mockClear();
    });

    it("adds the W3C traceparent of the page to every request and keeps one a caller set", async () => {
        await itemAPI();

        expect(axiosInstance.interceptors.request.use).toHaveBeenCalledTimes(1);
        const [onRequest] = axiosInstance.interceptors.request.use.mock.calls[0] as [(config: { headers?: unknown }) => { headers: Record<string, string> }];
        const pattern = /^00-([0-9a-f]{32})-([0-9a-f]{16})-01$/;

        const plain = onRequest({headers: {Accept: "application/json"}});
        const again = onRequest({headers: {}});
        expect(plain.headers["traceparent"]).toMatch(pattern);
        expect(again.headers["traceparent"]).toMatch(pattern);
        expect(plain.headers["traceparent"].split("-")[1]).toBe(again.headers["traceparent"].split("-")[1]);
        expect(plain.headers["traceparent"].split("-")[2]).not.toBe(again.headers["traceparent"].split("-")[2]);
        expect(plain.headers["Accept"]).toBe("application/json");

        const explicit = onRequest({headers: {Traceparent: "00-11111111111111111111111111111111-2222222222222222-01"}});
        expect(explicit.headers["Traceparent"]).toBe("00-11111111111111111111111111111111-2222222222222222-01");
        expect(explicit.headers["traceparent"]).toBeUndefined();

        const set = jest.fn();
        const axiosHeaders = onRequest({headers: {set}});
        expect(set).toHaveBeenCalledWith("traceparent", expect.stringMatching(pattern), false);
        expect(axiosHeaders.headers).toBeDefined();

        const missing = onRequest({});
        expect(missing.headers["traceparent"]).toMatch(pattern);
    });

    it("creates the client at <base><member> and installs the unauthorized interceptor", async () => {
        await itemAPI();

        expect(create).toHaveBeenCalledWith({baseURL: "http://backend/api/items"});
        expect(axiosInstance.interceptors.response.use).toHaveBeenCalledTimes(1);
        const [onFulfilled, onRejected] = axiosInstance.interceptors.response.use.mock.calls[0] as [(r: unknown) => unknown, (e: unknown) => Promise<never>];
        expect(onFulfilled({data: 1})).toEqual({data: 1});
        await expect(onRejected({response: {status: 500}})).rejects.toEqual({response: {status: 500}});
    });

    it("sends the bearer token of a window-only session kept in session storage", async () => {
        const api = await itemAPI();
        sessionStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({token: "jwt-window", id: 1}));
        axiosInstance.get.mockResolvedValue({status: 200, data: []});

        await api.findAll();

        expect(axiosInstance.defaults.headers.common["Authorization"]).toBe("Bearer jwt-window");
    });

    it("sends the bearer token of the stored session with every request", async () => {
        const api = await itemAPI();
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({token: "jwt-token", id: 1}));
        axiosInstance.get.mockResolvedValue({status: 200, data: [{id: 1, name: "one"}]});

        await expect(api.findAll({active: true})).resolves.toEqual([{id: 1, name: "one"}]);

        expect(axiosInstance.get).toHaveBeenCalledWith("", {params: {active: true}});
        expect(axiosInstance.defaults.headers.common["Authorization"]).toBe("Bearer jwt-token");
        expect(axiosInstance.defaults.headers.put["Content-Type"]).toBe("application/json;charset=utf-8");
    });

    it("sends no authorization header without a stored session", async () => {
        const api = await itemAPI();
        axiosInstance.get.mockResolvedValue({status: 200, data: []});

        await api.findAll();

        expect(axiosInstance.get).toHaveBeenCalledWith("", {params: undefined});
        expect(axiosInstance.defaults.headers.common["Authorization"]).toBeUndefined();
    });

    it("findPageable posts the snake_case paged request to <base>/paged", async () => {
        const api = await itemAPI();
        const page = {content: [{id: 2, name: "two"}], page: 0, size: 10, total_elements: 1, total_pages: 1, first: true, last: true, empty: false};
        axiosInstance.post.mockResolvedValue({status: 200, data: page});

        const result = await api.findPageable({
            page: 0,
            size: 10,
            sort_by: "name",
            direction: "ASC",
            search: "tw",
            case_sensitive: false,
            filter_column: "name"
        });

        expect(axiosInstance.post).toHaveBeenCalledWith("paged", {
            page: 0, size: 10, sort_by: "name", direction: "ASC", search: "tw", case_sensitive: false, filter_column: "name"
        });
        expect(result.total_pages).toBe(1);
        expect(result.content[0].name).toBe("two");
    });

    it("findById appends the query string only when parameters are given", async () => {
        const api = await itemAPI();
        axiosInstance.get.mockResolvedValue({status: 200, data: {id: 3, name: "three"}});

        await expect(api.findById(3, null)).resolves.toEqual({id: 3, name: "three"});
        expect(axiosInstance.get).toHaveBeenLastCalledWith("/3");

        await api.findById(3, "");
        expect(axiosInstance.get).toHaveBeenLastCalledWith("/3");

        await api.findById(3, "expand=acl");
        expect(axiosInstance.get).toHaveBeenLastCalledWith("/3?expand=acl");
    });

    it("create posts and update puts the payload to the collection path", async () => {
        const api = await itemAPI();
        axiosInstance.post.mockResolvedValue({status: 200, data: {id: 4, name: "four"}});
        axiosInstance.put.mockResolvedValue({status: 200, data: {id: 4, name: "four updated"}});

        await expect(api.create({id: 0, name: "four"})).resolves.toEqual({id: 4, name: "four"});
        expect(axiosInstance.post).toHaveBeenCalledWith("", {id: 0, name: "four"});

        await expect(api.update({id: 4, name: "four updated"})).resolves.toEqual({id: 4, name: "four updated"});
        expect(axiosInstance.put).toHaveBeenCalledWith("", {id: 4, name: "four updated"});
    });

    it("delete reports success only for a 200 response", async () => {
        const api = await itemAPI();
        axiosInstance.delete.mockResolvedValueOnce({status: 200, data: null}).mockResolvedValueOnce({status: 204, data: null});

        await expect(api.delete(5)).resolves.toBe(true);
        expect(axiosInstance.delete).toHaveBeenCalledWith("/5");
        await expect(api.delete(6)).resolves.toBe(false);
    });
});
