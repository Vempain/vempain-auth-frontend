/**
 * @jest-environment jsdom
 */

import {beforeEach, describe, expect, it} from "@jest/globals";
import dayjs from "dayjs";
import type {LoginResponse} from "../models";
import {getStoredSession} from "../session/SessionProvider";
import {isSessionExpired} from "../session/sessionExpiration";

function createSession(expiresAt: string): LoginResponse {
    return {
        token: "token",
        id: 1,
        login: "user",
        nickname: "User",
        email: "user@example.com",
        units: [],
        expires_at: dayjs(expiresAt)
    };
}

describe("session expiration", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("accepts a session whose expiry is in the future", () => {
        const now = dayjs("2026-08-10T12:00:00.000Z");

        expect(isSessionExpired(createSession("2026-08-10T13:00:00.000Z"), now)).toBe(false);
    });

    it("rejects sessions whose expiry has passed", () => {
        expect(isSessionExpired(createSession("2026-07-27T07:02:44.108626334Z"))).toBe(true);
    });

    it("removes an expired stored session before restoring it", () => {
        localStorage.setItem("vempainUser", JSON.stringify(createSession("2026-07-27T07:02:44.108626334Z")));

        expect(getStoredSession()).toBeNull();
        expect(localStorage.getItem("vempainUser")).toBeNull();
    });

    it("rejects missing or invalid expiry values", () => {
        expect(isSessionExpired(createSession("not-a-date"))).toBe(true);
        expect(isSessionExpired({...createSession("2026-08-10T13:00:00.000Z"), expires_at: undefined as never})).toBe(true);
    });
});
