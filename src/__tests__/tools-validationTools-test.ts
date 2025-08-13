import {validateParamId} from "../tools";

describe('validationTools.ts Tests', () => {
    describe('validateParamId', () => {

        it('returns a number when the string is a number', () => {
            expect(validateParamId("7")).toBe(7);
        });

        it('returns -1 when the string is empty', () => {
            expect(validateParamId("")).toBe(-1);
        });

        it('returns -1 when the string is undefined', () => {
            expect(validateParamId(undefined)).toBe(-1);
        });
    });
});