/**
 * W3C Trace Context for the browser side of a trace. The SPA generates one trace id when this module loads (one per page
 * load of the application) and a fresh span id for every request, so that all API calls of one page view share a trace id
 * that Traefik and the backends continue. The ids are random: 16 bytes for the trace id, 8 for the span id, hex encoded,
 * sent as `traceparent: 00-<trace id>-<span id>-01` (version 00, sampled). The HTML and asset loads of the page cannot
 * carry the header (browser navigations send no custom headers) and remain separate traces on the Traefik side.
 */
export interface TraceContext {
    /** The trace id of this page load, 32 lowercase hex characters. */
    readonly traceId: string;

    /** A new `traceparent` header value for one request: the page trace id with a fresh span id. */
    nextTraceparent(): string;
}

const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;
const TRACEPARENT_VERSION = "00";
const TRACEPARENT_SAMPLED = "01";

let pageContext: TraceContext | undefined;

function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    const webCrypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;

    if (webCrypto && typeof webCrypto.getRandomValues === "function") {
        webCrypto.getRandomValues(bytes);
    } else {
        // Environments without Web Crypto (very old browsers, bare test runners): not cryptographically strong, but trace
        // ids only need to be unique
        for (let index = 0; index < length; index++) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }

    return bytes;
}

/**
 * Random hex id of the given byte length; the all-zero value is invalid in the specification and is replaced.
 */
export function randomHexId(length: number): string {
    const bytes = randomBytes(length);

    if (bytes.every(byte => byte === 0)) {
        bytes[length - 1] = 1;
    }

    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds a trace context with a new trace id. The application-wide context of the page is created once by
 * {@link currentTraceId} / {@link nextTraceparent}; this factory exists for tests and for code that wants a separate trace.
 */
export function createTraceContext(): TraceContext {
    const traceId = randomHexId(TRACE_ID_BYTES);

    return {
        traceId,
        nextTraceparent: () => `${TRACEPARENT_VERSION}-${traceId}-${randomHexId(SPAN_ID_BYTES)}-${TRACEPARENT_SAMPLED}`
    };
}

function pageTraceContext(): TraceContext {
    if (!pageContext) {
        pageContext = createTraceContext();
        // Once per page load, so that a user can quote the id of what they did when reporting a problem
        console.debug(`[vempain] page trace id ${pageContext.traceId}`);
    }

    return pageContext;
}

/** The trace id of this page load. */
export function currentTraceId(): string {
    return pageTraceContext().traceId;
}

/** A `traceparent` header value for the next request of this page load. */
export function nextTraceparent(): string {
    return pageTraceContext().nextTraceparent();
}

/** Matches a well-formed `traceparent` value as this module produces it. */
export const TRACEPARENT_PATTERN = /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/;
