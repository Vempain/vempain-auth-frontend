/**
 * @jest-environment jsdom
 */

import type {LoginResponse} from "../models";
import {VEMPAIN_LOCAL_STORAGE_KEY} from "../models";
import {clearStoredSession, isStoredSessionRemembered, readStoredSession, readStoredSessionText, writeStoredSession} from "../session/sessionStore";

const session: LoginResponse = {
    token: "jwt-token",
    id: 7,
    login: "seven",
    nickname: "Seven",
    email: "seven@example.com",
    units: [],
    expires_at: "2099-01-01T00:00:00Z" as never
};

describe("sessionStore", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("reads nothing without a session", () => {
        expect(readStoredSessionText()).toBeNull();
        expect(readStoredSession()).toBeNull();
        expect(isStoredSessionRemembered()).toBe(false);
    });

    it("keeps a remembered login in local storage only", () => {
        writeStoredSession(session, true);

        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "null")).toEqual(session);
        expect(sessionStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(readStoredSession()).toEqual(session);
        expect(isStoredSessionRemembered()).toBe(true);
    });

    it("keeps a login without remember me in session storage only", () => {
        writeStoredSession(session, false);

        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(JSON.parse(sessionStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "null")).toEqual(session);
        expect(readStoredSession()).toEqual(session);
        expect(isStoredSessionRemembered()).toBe(false);
    });

    it("moves the session when a new login makes the other choice", () => {
        writeStoredSession(session, true);
        writeStoredSession({...session, login: "window"}, false);
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(readStoredSession()?.login).toBe("window");

        writeStoredSession({...session, login: "kept"}, true);
        expect(sessionStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(readStoredSession()?.login).toBe("kept");
    });

    it("keeps a renewal in the storage the login chose, and in local storage without any session", () => {
        writeStoredSession(session, false);
        writeStoredSession({...session, token: "jwt-2"});
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(JSON.parse(sessionStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "{}").token).toBe("jwt-2");

        clearStoredSession();
        writeStoredSession({...session, token: "jwt-3"});
        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "{}").token).toBe("jwt-3");
        expect(sessionStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("prefers local storage when both hold a session and clears both", () => {
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({...session, login: "local"}));
        sessionStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({...session, login: "window"}));
        expect(readStoredSession()?.login).toBe("local");

        clearStoredSession();
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        expect(sessionStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("returns the raw text but no parsed session for a corrupt entry", () => {
        sessionStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, "{broken");
        expect(readStoredSessionText()).toBe("{broken");
        expect(readStoredSession()).toBeNull();
    });
});
