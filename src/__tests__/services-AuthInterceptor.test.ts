/**
 * @jest-environment jsdom
 */

import {jest} from "@jest/globals";
import type {AxiosError, AxiosInstance} from "axios";
import {RENEWED_TOKEN_EXPIRES_AT_HEADER, RENEWED_TOKEN_HEADER, VEMPAIN_LOCAL_STORAGE_KEY} from "../models";
import {
    adoptRenewedSession,
    clearOnSessionRenewedCallback,
    clearOnUnauthorizedCallback,
    removeAuthInterceptor,
    resetUnauthorizedHandling,
    setLoginPath,
    setOnSessionRenewedCallback,
    setOnUnauthorizedCallback,
    setupAuthInterceptor
} from "../services/AuthInterceptor";

type Fulfilled = (response: unknown) => unknown;
type Rejected = (error: AxiosError) => Promise<never>;

function fakeAxios() {
    const use = jest.fn<(onFulfilled: Fulfilled, onRejected: Rejected) => number>().mockReturnValue(42);
    const eject = jest.fn();
    const instance = {interceptors: {response: {use, eject}}} as unknown as AxiosInstance;
    const id = setupAuthInterceptor(instance);
    const [onFulfilled, onRejected] = use.mock.calls[0];
    return {instance, id, eject, onFulfilled, onRejected};
}

function error(status: number | undefined): AxiosError {
    return {response: status === undefined ? undefined : {status}} as AxiosError;
}

describe("AuthInterceptor", () => {
    let errorSpy: jest.SpiedFunction<typeof console.error>;
    let warnSpy: jest.SpiedFunction<typeof console.warn>;

    beforeEach(() => {
        jest.useFakeTimers({now: 100_000});
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({token: "jwt", id: 1}));
        resetUnauthorizedHandling();
        clearOnUnauthorizedCallback();
        clearOnSessionRenewedCallback();
        setLoginPath("/login");
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        localStorage.clear();
    });

    it("passes successful responses through and returns the interceptor id", () => {
        const {id, onFulfilled} = fakeAxios();
        const response = {status: 200, data: "ok"};

        expect(id).toBe(42);
        expect(onFulfilled(response)).toBe(response);
    });

    it("stores a renewed token from a successful response and tells the registered callback", () => {
        const renewed = jest.fn();
        setOnSessionRenewedCallback(renewed);
        const {onFulfilled} = fakeAxios();
        const response = {status: 200, data: "ok", headers: {"x-vempain-token": "jwt-2", "x-vempain-token-expires-at": "2099-01-01T00:10:00Z"}};

        expect(onFulfilled(response)).toBe(response);

        const stored = JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "{}");
        expect(stored).toEqual({token: "jwt-2", id: 1, expires_at: "2099-01-01T00:10:00Z"});
        expect(renewed).toHaveBeenCalledWith({token: "jwt-2", id: 1, expires_at: "2099-01-01T00:10:00Z"});
    });

    it("stores a renewed token from an error response that is not a 401", async () => {
        const renewed = jest.fn();
        setOnSessionRenewedCallback(renewed);
        const {onRejected} = fakeAxios();
        const headers = new Map([[RENEWED_TOKEN_HEADER, "jwt-3"], [RENEWED_TOKEN_EXPIRES_AT_HEADER, "2099-01-01T00:20:00Z"]]);
        const rejection = {response: {status: 404, headers: {get: (name: string) => headers.get(name)}}} as unknown as AxiosError;

        await expect(onRejected(rejection)).rejects.toBe(rejection);

        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "{}").token).toBe("jwt-3");
        expect(renewed).toHaveBeenCalledTimes(1);
    });

    it("ignores responses without a renewed token, the same token again, and renewals while nothing is stored", () => {
        const renewed = jest.fn();
        setOnSessionRenewedCallback(renewed);

        adoptRenewedSession(undefined);
        adoptRenewedSession({"content-type": "application/json"});
        adoptRenewedSession({"x-vempain-token": "jwt"});
        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "{}")).toEqual({token: "jwt", id: 1});

        localStorage.removeItem(VEMPAIN_LOCAL_STORAGE_KEY);
        adoptRenewedSession({"x-vempain-token": "jwt-4"});
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();

        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, "not json");
        adoptRenewedSession({"x-vempain-token": "jwt-4"});
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBe("not json");
        expect(renewed).not.toHaveBeenCalled();
    });

    it("keeps the stored expiry when the renewal carries none and survives a failing callback", () => {
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({token: "jwt", id: 1, expires_at: "2099-01-01T00:00:00Z"}));
        setOnSessionRenewedCallback(() => {
            throw new Error("boom");
        });

        adoptRenewedSession({"X-Vempain-Token": "jwt-5"});

        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "{}")).toEqual({token: "jwt-5", id: 1, expires_at: "2099-01-01T00:00:00Z"});
        expect(errorSpy).toHaveBeenCalled();
    });

    it("clears the session and calls the registered callback on a 401", async () => {
        const callback = jest.fn();
        setOnUnauthorizedCallback(callback);
        const {onRejected} = fakeAxios();
        const rejection = error(401);

        await expect(onRejected(rejection)).rejects.toBe(rejection);

        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("keeps the session on a 403, on other errors and on network failures", async () => {
        const callback = jest.fn();
        setOnUnauthorizedCallback(callback);
        const {onRejected} = fakeAxios();

        await expect(onRejected(error(403))).rejects.toEqual(error(403));
        await expect(onRejected(error(500))).rejects.toEqual(error(500));
        await expect(onRejected(error(undefined))).rejects.toEqual(error(undefined));

        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).not.toBeNull();
        expect(callback).not.toHaveBeenCalled();
    });

    it("debounces repeated 401 responses for two seconds and handles them again afterwards", async () => {
        const callback = jest.fn();
        setOnUnauthorizedCallback(callback);
        const {onRejected} = fakeAxios();

        await onRejected(error(401)).catch(() => undefined);
        jest.setSystemTime(100_000 + 1_999);
        await onRejected(error(401)).catch(() => undefined);
        expect(callback).toHaveBeenCalledTimes(1);

        jest.setSystemTime(100_000 + 2_000);
        await onRejected(error(401)).catch(() => undefined);
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("handles a 401 right after a successful login again thanks to the reset", async () => {
        const callback = jest.fn();
        setOnUnauthorizedCallback(callback);
        const {onRejected} = fakeAxios();

        await onRejected(error(401)).catch(() => undefined);
        resetUnauthorizedHandling();
        await onRejected(error(401)).catch(() => undefined);

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("falls back to a redirect to the configured login path when the callback throws", async () => {
        setLoginPath("/signin");
        setOnUnauthorizedCallback(() => {
            throw new Error("boom");
        });
        const {onRejected} = fakeAxios();

        await onRejected(error(401)).catch(() => undefined);

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Error in unauthorized callback"), expect.any(Error));
        // jsdom cannot navigate; it reports the attempted redirect through the virtual console
        expect(errorSpy.mock.calls.some(call => String(call[0]).includes("Not implemented: navigation"))).toBe(true);
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("redirects to the login path when no callback is registered", async () => {
        const {onRejected} = fakeAxios();

        await onRejected(error(401)).catch(() => undefined);

        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("No unauthorized callback registered"), "/login");
        expect(errorSpy.mock.calls.some(call => String(call[0]).includes("Not implemented: navigation"))).toBe(true);
    });

    it("no longer calls a cleared callback", async () => {
        const callback = jest.fn();
        setOnUnauthorizedCallback(callback);
        clearOnUnauthorizedCallback();
        const {onRejected} = fakeAxios();

        await onRejected(error(401)).catch(() => undefined);

        expect(callback).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
    });

    it("removeAuthInterceptor ejects the interceptor by its id", () => {
        const {instance, id, eject} = fakeAxios();

        removeAuthInterceptor(instance, id);

        expect(eject).toHaveBeenCalledWith(42);
    });
});
