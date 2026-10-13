// Jest runs the component tests under jsdom, which provides no TextEncoder/TextDecoder; react-router needs them at import time.
import {TextDecoder, TextEncoder} from "node:util";

if (typeof globalThis.TextEncoder === "undefined") {
    Object.defineProperty(globalThis, "TextEncoder", {writable: true, configurable: true, value: TextEncoder});
}

if (typeof globalThis.TextDecoder === "undefined") {
    Object.defineProperty(globalThis, "TextDecoder", {writable: true, configurable: true, value: TextDecoder});
}
