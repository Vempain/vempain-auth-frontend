import type {UnitVO} from "../models";
import {collectDescendantUnitIds, selectableMemberUnits, wouldCreateUnitCycle} from "../tools/unitTools";

function unit(id: number, unit_ids: number[] = []): UnitVO {
    return {
        id,
        name: `unit ${id}`,
        description: "",
        acls: [],
        user_ids: [],
        unit_ids,
        locked: false,
        creator: 1,
        created: null as never,
        modifier: null,
        modified: null
    };
}

// 1 contains 2, 2 contains 3 and 4, 5 is separate
const units = [unit(1, [2]), unit(2, [3, 4]), unit(3), unit(4), unit(5)];

describe("unitTools", () => {
    it("collects descendants through the whole chain", () => {
        expect(collectDescendantUnitIds([1], units)).toEqual(new Set([2, 3, 4]));
        expect(collectDescendantUnitIds([2], units)).toEqual(new Set([3, 4]));
        expect(collectDescendantUnitIds([5], units)).toEqual(new Set());
        expect(collectDescendantUnitIds([99], units)).toEqual(new Set());
    });

    it("detects cycles at any depth", () => {
        expect(wouldCreateUnitCycle(1, [1], units)).toBe(true);
        // 3 is inside 2 inside 1: 3 containing 1 closes the loop
        expect(wouldCreateUnitCycle(3, [1], units)).toBe(true);
        expect(wouldCreateUnitCycle(2, [5, 1], units)).toBe(true);
        expect(wouldCreateUnitCycle(3, [4], units)).toBe(false);
        expect(wouldCreateUnitCycle(1, [5], units)).toBe(false);
        expect(wouldCreateUnitCycle(5, [1], units)).toBe(false);
        expect(wouldCreateUnitCycle(1, [], units)).toBe(false);
    });

    it("offers only units that cannot lead back to the edited unit", () => {
        expect(selectableMemberUnits(3, units).map(u => u.id)).toEqual([4, 5]);
        expect(selectableMemberUnits(1, units).map(u => u.id)).toEqual([2, 3, 4, 5]);
        expect(selectableMemberUnits(5, units).map(u => u.id)).toEqual([1, 2, 3, 4]);
        // A unit that is not saved yet may contain anything
        expect(selectableMemberUnits(0, units).map(u => u.id)).toEqual([1, 2, 3, 4, 5]);
    });
});
