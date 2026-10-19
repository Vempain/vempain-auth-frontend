/**
 * @jest-environment jsdom
 */

import {jest} from "@jest/globals";

describe("traceparent", () => {
    const consoleDebug = jest.spyOn(console, "debug").mockImplementation(() => undefined);

    beforeEach(() => {
        jest.resetModules();
        consoleDebug.mockClear();
    });

    afterAll(() => {
        consoleDebug.mockRestore();
    });

    it("produces W3C headers with one trace id per page load and a new span id per request", async () => {
        const {currentTraceId, nextTraceparent, TRACEPARENT_PATTERN} = await import("../tools/traceparent");

        const first = nextTraceparent();
        const second = nextTraceparent();

        expect(first).toMatch(TRACEPARENT_PATTERN);
        expect(second).toMatch(TRACEPARENT_PATTERN);
        expect(first.split("-")[1]).toBe(currentTraceId());
        expect(second.split("-")[1]).toBe(currentTraceId());
        expect(first.split("-")[2]).not.toBe(second.split("-")[2]);
        expect(currentTraceId()).toHaveLength(32);
        expect(consoleDebug).toHaveBeenCalledTimes(1);
        expect(consoleDebug).toHaveBeenCalledWith(`[vempain] page trace id ${currentTraceId()}`);
    });

    it("creates independent contexts on request", async () => {
        const {createTraceContext, TRACEPARENT_PATTERN} = await import("../tools/traceparent");

        const one = createTraceContext();
        const two = createTraceContext();

        expect(one.traceId).not.toBe(two.traceId);
        expect(one.nextTraceparent()).toMatch(TRACEPARENT_PATTERN);
        expect(one.nextTraceparent().split("-")[1]).toBe(one.traceId);
        expect(consoleDebug).not.toHaveBeenCalled();
    });

    it("falls back to Math.random without Web Crypto and never yields the all-zero id", async () => {
        const originalCrypto = globalThis.crypto;
        Object.defineProperty(globalThis, "crypto", {value: undefined, configurable: true});
        const random = jest.spyOn(Math, "random").mockReturnValue(0);
        try {
            const {randomHexId, nextTraceparent, TRACEPARENT_PATTERN} = await import("../tools/traceparent");

            expect(randomHexId(8)).toBe("0000000000000001");
            expect(random).toHaveBeenCalled();
            expect(nextTraceparent()).toMatch(TRACEPARENT_PATTERN);
        } finally {
            random.mockRestore();
            Object.defineProperty(globalThis, "crypto", {value: originalCrypto, configurable: true});
        }
    });

    it("replaces an all-zero id drawn from Web Crypto as well", async () => {
        const getRandomValues = jest.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(array => array);
        try {
            const {randomHexId} = await import("../tools/traceparent");

            expect(randomHexId(16)).toBe("00000000000000000000000000000001");
            expect(getRandomValues).toHaveBeenCalled();
        } finally {
            getRandomValues.mockRestore();
        }
    });
});
