import type {UnitVO} from "../models";

/** The units of a list by id, so that membership chains can be followed */
function byId(units: UnitVO[]): Map<number, UnitVO> {
    return new Map(units.map(unit => [unit.id, unit]));
}

/**
 * IDs of every unit contained in the given units, directly or through other units, according to the `unit_ids` of the list.
 */
export function collectDescendantUnitIds(unitIds: number[], units: UnitVO[]): Set<number> {
    const index = byId(units);
    const visited = new Set<number>();
    const queue = [...unitIds];

    while (queue.length > 0) {
        const current = queue.shift() as number;
        for (const childId of index.get(current)?.unit_ids ?? []) {
            if (!visited.has(childId)) {
                visited.add(childId);
                queue.push(childId);
            }
        }
    }

    return visited;
}

/**
 * Whether making `childUnitIds` the sub-units of `unitId` would let the unit contain itself: the unit is among them, or the unit is
 * contained (at any depth) in one of them. Mirrors the backend backstop so that the editor can refuse the choice up front.
 */
export function wouldCreateUnitCycle(unitId: number, childUnitIds: number[], units: UnitVO[]): boolean {
    if (childUnitIds.includes(unitId)) {
        return true;
    }
    return collectDescendantUnitIds(childUnitIds, units).has(unitId);
}

/**
 * The units that can still become sub-units of `unitId` without a cycle: not the unit itself and no unit that contains it.
 * For a unit that is not saved yet (`unitId` 0) every unit qualifies.
 */
export function selectableMemberUnits(unitId: number, units: UnitVO[]): UnitVO[] {
    if (unitId <= 0) {
        return units;
    }
    return units.filter(candidate => candidate.id !== unitId && !wouldCreateUnitCycle(unitId, [candidate.id], units));
}
