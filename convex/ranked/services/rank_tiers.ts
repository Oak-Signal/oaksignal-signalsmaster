import { FLEET_RANKS } from "../constants";

export type FleetRankDefinition = (typeof FLEET_RANKS)[number];

export function getFleetRankForPosition(position: number): FleetRankDefinition {
  if (!Number.isInteger(position) || position < 1) {
    return FLEET_RANKS[FLEET_RANKS.length - 1];
  }

  for (const rank of FLEET_RANKS) {
    if (position >= rank.minPosition && position <= rank.maxPosition) {
      return rank;
    }
  }

  return FLEET_RANKS[FLEET_RANKS.length - 1];
}
