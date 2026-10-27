import {type LoginResponse, VEMPAIN_LOCAL_STORAGE_KEY} from "../models";

/**
 * The one place that reads and writes the persisted session. "Remember me" on the login form decides where it lives: checked, the session
 * is kept in local storage and survives closing the browser; unchecked, it is kept in session storage, which the browser discards when the
 * window closes (and which a new tab does not share). At most one of the two ever holds a session. Renewals keep the storage the session is in.
 */

function rememberedStorage(): Storage {
    return window.localStorage;
}

function forgottenStorage(): Storage {
    return window.sessionStorage;
}

/** The persisted session exactly as stored, or null; a session in local storage wins should both storages hold one. */
export function readStoredSessionText(): string | null {
    return rememberedStorage().getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? forgottenStorage().getItem(VEMPAIN_LOCAL_STORAGE_KEY);
}

/** The persisted session parsed, or null when there is none or it cannot be parsed. The expiry is not checked here. */
export function readStoredSession(): LoginResponse | null {
    const text = readStoredSessionText();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text) as LoginResponse;
    } catch {
        return null;
    }
}

/** True when the persisted session is kept across browser restarts ("Remember me"); false without a session. */
export function isStoredSessionRemembered(): boolean {
    return rememberedStorage().getItem(VEMPAIN_LOCAL_STORAGE_KEY) !== null;
}

/**
 * Persists the session. With `remember` given (a login) the session goes to the storage that choice selects and leaves the other one;
 * without it (a renewal or refresh) it stays where the current session is, in local storage when there is no current session.
 */
export function writeStoredSession(session: LoginResponse, remember?: boolean): void {
    const keep = remember ?? (forgottenStorage().getItem(VEMPAIN_LOCAL_STORAGE_KEY) === null || isStoredSessionRemembered());
    const target = keep ? rememberedStorage() : forgottenStorage();
    const other = keep ? forgottenStorage() : rememberedStorage();
    other.removeItem(VEMPAIN_LOCAL_STORAGE_KEY);
    target.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(session));
}

/** Removes the persisted session from both storages. */
export function clearStoredSession(): void {
    rememberedStorage().removeItem(VEMPAIN_LOCAL_STORAGE_KEY);
    forgottenStorage().removeItem(VEMPAIN_LOCAL_STORAGE_KEY);
}
