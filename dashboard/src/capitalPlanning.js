// Capital-event triggers: which systems are approaching, inside, or past
// their replacement window — the big-ticket conversations worth having
// before the failure forces them. Pure derivation over the systems record
// (replacementHorizon does the arithmetic; this ranks and phrases it).

import { replacementHorizon, fmtMoneyRange } from "./benchmarks"

const STATUS_RANK = { past: 0, "in-window": 1, approaching: 2 }

// Systems with a live capital horizon, most pressing first. Healthy systems
// and those without an install year (no arithmetic possible) drop out —
// which is also why the census fill matters: every dated system joins.
export function capitalEvents(systems = [], nowYear = new Date().getFullYear()) {
  return systems
    .map((s) => ({ system: s, horizon: replacementHorizon(s, nowYear) }))
    .filter((x) => x.horizon && x.horizon.status !== "healthy")
    .sort(
      (a, b) =>
        STATUS_RANK[a.horizon.status] - STATUS_RANK[b.horizon.status] ||
        a.horizon.windowStart - b.horizon.windowStart
    )
}

// One planning sentence per event, founder-voiced.
export function capitalPhrase({ system, horizon: h }) {
  const cost = fmtMoneyRange(h.benchmark.replaceCost, h.benchmark.costUnit)
  if (h.status === "past")
    return `${system.category} is beyond its typical life (year ${h.age} of ${h.benchmark.lifeYears[0]}–${h.benchmark.lifeYears[1]}) — budget ~${cost} and plan the replacement conversation now.`
  if (h.status === "in-window")
    return `${system.category} is in its replacement window (${h.windowStart}–${h.windowEnd}) — ~${cost}. Worth pricing before it forces the issue.`
  return `${system.category} enters its replacement window in ${h.windowStart} — ~${cost}. A heads-up conversation this year keeps it a choice, not an emergency.`
}

export const CAPITAL_STATUS_WORD = {
  past: "beyond typical life",
  "in-window": "in the window now",
  approaching: "window approaching",
}
