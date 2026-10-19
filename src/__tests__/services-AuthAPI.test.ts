/**
 * @jest-environment jsdom
 */

import {jest} from "@jest/globals";
import type {LoginResponse} from "../models";
import {VEMPAIN_LOCAL_STORAGE_KEY} from "../models";

const axiosInstance = {
    defaults: {headers: {common: {}, get: {}, post: {}, put: {}, delete: {}}},
    post: jest.fn<(...args: unknown[]) => Promise<{ status: number; data: unknown }>>(),
    interceptors: {request: {use: jest.fn(), eject: jest.fn()}, response: {use: jest.fn(), eject: jest.fn()}}
};
const create = jest.fn(() => axiosInstance);

jest.mock("axios", () => ({
    __esModule: true,
    default: {create: (...args: unknown[]) => create(...args as [])}
}));

const session: LoginResponse = {
    token: "jwt-token",
    id: 7,
    login: "seven",
    nickname: "Seven",
    email: "seven@example.com",
    units: [],
    expires_at: "2099-01-01T00:00:00Z" as never
};

describe("AuthAPI", () => {
    let errorSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        localStorage.clear();
        axiosInstance.post.mockReset();
        create.mockClear();
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("posts the credentials to <base>/login and stores the session", async () => {
        const {AuthAPI} = await import("../services/AuthAPI");
        const authAPI = new AuthAPI("http://backend/api");
        axiosInstance.post.mockResolvedValue({status: 200, data: session});

        const result = await authAPI.login({login: "seven", password: "secret"});

        expect(create).toHaveBeenCalledWith({baseURL: "http://backend/api/login"});
        expect(axiosInstance.post).toHaveBeenCalledWith("", {login: "seven", password: "secret"});
        expect(result).toEqual(session);
        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "null")).toEqual(session);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("does not store a session when the response carries no user id", async () => {
        const {AuthAPI} = await import("../services/AuthAPI");
        const authAPI = new AuthAPI("http://backend/api");
        axiosInstance.post.mockResolvedValue({status: 200, data: {...session, id: 0}});

        const result = await authAPI.login({login: "seven", password: "secret"});

        expect(result.id).toBe(0);
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("did not contain data.token"));
    });

    it("does not store a session for a non-200 status", async () => {
        const {AuthAPI} = await import("../services/AuthAPI");
        const authAPI = new AuthAPI("http://backend/api");
        axiosInstance.post.mockResolvedValue({status: 202, data: session});

        await authAPI.login({login: "seven", password: "secret"});

        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("The response status was 202"));
    });

    it("rejects when the request fails and leaves the storage alone", async () => {
        const {AuthAPI} = await import("../services/AuthAPI");
        const authAPI = new AuthAPI("http://backend/api");
        axiosInstance.post.mockRejectedValue(new Error("Unauthorized"));

        await expect(authAPI.login({login: "seven", password: "wrong"})).rejects.toThrow("Unauthorized");
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("logout removes the stored session", async () => {
        const {AuthAPI} = await import("../services/AuthAPI");
        const authAPI = new AuthAPI("http://backend/api");
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(session));

        authAPI.logout();

        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });
});
