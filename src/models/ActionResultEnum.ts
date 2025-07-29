export const ActionResultEnum = {
    SUCCESS: "SUCCESS",
    FAILURE: 'FAILURE',
} as const;

export type ActionResultEnum = (typeof ActionResultEnum)[keyof typeof ActionResultEnum];