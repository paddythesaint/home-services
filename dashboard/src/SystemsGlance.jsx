// "Systems at a glance": the one summary of the systems inventory, shared
// by the Overview and the Health Report so the same numbers, grouped the
// same way, greet the user everywhere. Every row is a door — it lands on
// the matching trade section of the Health Report.

import { Link } from "react-router-dom"
import { groupByTrade } from "./trades"

// One line of truth about a trade group: how many systems, how many are
// crying for attention, how many we haven't laid eyes on yet.
export function tradeRollup(list) {
  const urgent = list.filter((s) => s.condition === "urgent").length
  const attention = list.filter((s) => s.condition === "attention").length
  const unverified = list.filter((s) => !s.verified).length
  const parts = [`${list.length} system${list.length === 1 ? "" : "s"}`]
  if (urgent) parts.push(`${urgent} urgent`)
  if (attention) parts.push(`${attention} need${attention === 1 ? "s" : ""} attention`)
  if (!urgent && !attention) parts.push("all good")
  if (unverified) parts.push(`${unverified} unverified`)
  return parts.join(" · ")
}

export default function SystemsGlance({ items, intro = false }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-3">No systems recorded yet.</p>
  }
  const groups = groupByTrade(items)
  return (
    <div>
      {intro && (
        <p className="text-sm text-ink-2 mb-3">
          {items.length} system{items.length === 1 ? "" : "s"} across {groups.length}{" "}
          trade group{groups.length === 1 ? "" : "s"}. Each system is tracked on its
          own — grouped here by the trade that services it.
        </p>
      )}
      <div className="divide-y divide-line">
        {groups.map(({ trade, items: groupItems }) => (
          <div
            key={trade.key}
            className="flex items-baseline justify-between gap-3 py-1.5"
          >
            <Link
              to={`/health-report#trade-${trade.key}`}
              className="text-sm font-medium text-ink hover:text-brand-700"
            >
              {trade.label}
            </Link>
            <span className="text-xs text-ink-3 text-right">
              {tradeRollup(groupItems)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
