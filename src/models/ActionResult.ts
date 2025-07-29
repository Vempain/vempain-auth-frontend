export const ActionResult = {
    OK: "OK",
    FAIL: "FAIL",
    NO_CHANGE: "NO_CHANGE",
} as const;

export type ActionResult = (typeof ActionResult)[keyof typeof ActionResult];