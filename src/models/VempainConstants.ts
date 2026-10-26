export const VEMPAIN_LOCAL_STORAGE_KEY = "vempainUser";
/**
 * Response header of the backends carrying a renewed session token: every authenticated request the user triggered answers with a
 * fresh token whose lifetime starts at that request (the session slides). AuthInterceptor stores it in place of the old one.
 */
export const RENEWED_TOKEN_HEADER = "X-Vempain-Token";
/** Response header next to RENEWED_TOKEN_HEADER: the expiry of the renewed token as an ISO-8601 instant. */
export const RENEWED_TOKEN_EXPIRES_AT_HEADER = "X-Vempain-Token-Expires-At";
/**
 * Request header a client sets to "true" on requests the user did not trigger (task polling, automatic refreshes): the backend serves
 * them without renewing the session, so an open page does not keep an idle session alive.
 */
export const BACKGROUND_REQUEST_HEADER = "X-Vempain-Background";
