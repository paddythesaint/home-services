// The repair-vs-replace doctrine: when a system acts up, the record
// answers "keep fixing it, or stop putting money in?" from three things
// it already knows — where the system sits in its typical life, what
// repairs have cost lately, and what replacement runs. Transparent rules,
// founder-voiced; no black box.
//
// The classic contractor heuristics encoded here:
//   · past typical life → replace (repairs are borrowed time)
//   · in the window + meaningful recent repair spend → replace
//   · in the window otherwise → lean replace (safety fixes only)
//   · the 50% rule: any single repair estimate clearing half of
//     replacement cost argues for replacement on an aging unit

import { replacementHorizon } from "./benchmarks"
import { overlap } from "./recordAudit"

const money = (n) => `$${Math.round(n).toLocaleString()}`
const jobCost = (j) => Number(String(j.cost || "").replace(/[^0-9.]/g, "")) || 0

const relatedJob = (j, system) =>
  (j.status || "completed") === "completed" &&
  ((j.category && j.category === system.category) || overlap(j.title, system.category) >= 0.6)

// → null when no doctrine is possible (no install year / no benchmark),
//   else { verdict: "repair"|"lean-replace"|"replace", headline, reasons,
//          costNotes, horizon, recentSpend }.
// `reasons` are currency-free (Simple-safe); `costNotes` carry the dollars.
export function repairVsReplace(system, { jobs = [], estimate = 0, now = new Date() } = {}) {
  const h = replacementHorizon(system, now.getFullYear())
  if (!h) return null

  const twoYearsAgo = now.getTime() - 2 * 365 * 86_400_000
  const recentSpend = jobs
    .filter((j) => relatedJob(j, system))
    .filter((j) => {
      const t = Date.parse(j.date || "")
      return !Number.isNaN(t) && t >= twoYearsAgo
    })
    .reduce((sum, j) => sum + jobCost(j), 0)

  const [lifeLo, lifeHi] = h.benchmark.lifeYears
  const [replaceLo] = h.benchmark.replaceCost
  const life = `year ${h.age} of a typical ${lifeLo}–${lifeHi}`

  const reasons = []
  const costNotes = []
  let verdict

  if (h.status === "past") {
    verdict = "replace"
    reasons.push(`It's beyond its typical life (${life}) — every repair now buys borrowed time.`)
  } else if (h.status === "in-window") {
    if (recentSpend >= 0.3 * replaceLo) {
      verdict = "replace"
      reasons.push(`It's in its replacement window (${h.windowStart}–${h.windowEnd}) and repairs keep coming.`)
      costNotes.push(`${money(recentSpend)} into repairs in the last two years — roughly a third of replacement already spent.`)
    } else {
      verdict = "lean-replace"
      reasons.push(
        `It's in its replacement window (${h.windowStart}–${h.windowEnd}) — keep it safe, but stop investing beyond that.`
      )
    }
  } else if (h.status === "approaching") {
    if (recentSpend >= 0.5 * replaceLo) {
      verdict = "lean-replace"
      reasons.push(`The window opens ${h.windowStart}, and this unit is already expensive to keep.`)
      costNotes.push(`${money(recentSpend)} in repairs over two years against replacement starting near ${money(replaceLo)}.`)
    } else {
      verdict = "repair"
      reasons.push(`Repairs are still good money — the replacement window doesn't open until ${h.windowStart}.`)
    }
  } else {
    verdict = "repair"
    reasons.push(`Only ${life} — fix it without hesitation.`)
  }

  // The 50% rule, applied when a concrete estimate is in hand.
  if (estimate > 0 && estimate >= 0.5 * replaceLo && verdict !== "replace") {
    verdict = h.status === "healthy" ? "lean-replace" : "replace"
    costNotes.push(
      `A ${money(estimate)} repair clears half the cost of replacing — the 50% rule says put that money toward the new unit.`
    )
  }

  const headline =
    verdict === "replace"
      ? "Replace it."
      : verdict === "lean-replace"
        ? "Keep it safe — but plan the replacement."
        : "Repair it."

  return { verdict, headline, reasons, costNotes, horizon: h, recentSpend }
}
