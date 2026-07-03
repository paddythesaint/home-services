import { isOpenPriority, openRequirements } from "./resolution"
import { todayISO } from "./dates"

// Rank the record's most valuable missing information — what the
// maintenance-manager assistant should ask for next. Order is the ask
// order: closeout requirements first (they block action on priorities),
// then overdue recurring checks, then missing system facts (worst
// condition first). Each gap carries a `label` (short, for chips) and an
// `ask` (a ready-to-send message).
export function computeGaps(systems, priorities) {
  const gaps = []

  for (const p of priorities.filter(isOpenPriority)) {
    const open = openRequirements(p)
    for (const i of open.info) {
      gaps.push({
        kind: "info",
        priorityId: p.id,
        label: `${p.title}: ${i.ask}`,
        ask: `For "${p.title}" — ${i.ask}`,
      })
    }
    for (const m of open.materials) {
      gaps.push({
        kind: "material",
        priorityId: p.id,
        label: `${p.title}: source ${m.item}`,
        ask: `Update on the ${m.item}${m.spec ? ` (${m.spec})` : ""} needed for "${p.title}" — purchased yet?`,
      })
    }
  }

  const today = todayISO()
  for (const s of systems) {
    if (s.nextDue && s.nextDue <= today) {
      gaps.push({
        kind: "check",
        systemId: s.id,
        label: `${s.category}: check overdue`,
        ask: `The recurring ${s.category} check is overdue — I can log a reading or status if you have one.`,
      })
    }
  }

  const condRank = { urgent: 0, attention: 1, good: 2 }
  const fieldGaps = []
  for (const s of systems) {
    const missing = []
    if (!s.brand) missing.push("brand")
    if (!s.installYear) missing.push("install year")
    if (!s.lastServiced) missing.push("last serviced")
    if (!s.location) missing.push("location")
    if (missing.length > 0) {
      fieldGaps.push({
        kind: "fact",
        systemId: s.id,
        rank: condRank[s.condition] ?? 2,
        label: `${s.category}: ${missing.join(", ")}`,
        ask: `For the ${s.category} — do you know the ${missing.join(", ")}?`,
      })
    }
  }
  fieldGaps.sort((a, b) => a.rank - b.rank)
  gaps.push(...fieldGaps)

  return gaps
}
