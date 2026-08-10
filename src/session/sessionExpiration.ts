import dayjs, {type Dayjs} from "dayjs";
import type {LoginResponse} from "../models";

/**
 * Returns true when a persisted session cannot be used for authentication.
 * The API response is serialized to local storage, so expires_at is normally
 * a string at runtime even though the model uses Dayjs.
 */
export function isSessionExpired(session: LoginResponse | null | undefined, now: Dayjs = dayjs()): boolean {
    if (!session?.expires_at) {
        return true;
    }

    const expiresAt = dayjs(session.expires_at);
    return !expiresAt.isValid() || !expiresAt.isAfter(now);
}
