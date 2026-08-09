import { useState } from "react"
import { useItems } from "./useItems"
import { Card } from "./components"

// "What we know" — the home's fact file, finally readable in one place.
// Facts have always powered the assistant, the Emergency card, and triage
// invisibly; once address research began filing batches of them, review
// needed a surface: read each fact, see where it came from, and archive
// what's wrong or stale. Archived facts keep their history but drop out
// of everything current (assistant context, emergency, audits).

const SOURCE_LABEL = {
  "address-research": "address research",
  "email-intake": "email intake",
  assistant: "assistant",
  walkthrough: "walkthrough",
}

export default function FactsCard({ uid }) {
  const { items, update } = useItems(uid, "facts")
  const [showAll, setShowAll] = useState(false)

  const active = items
    .filter((f) => !f.archived)
    .sort((a, b) => (b.order || 0) - (a.order || 0))
  const shown = showAll ? active : active.slice(0, 8)

  return (
    <Card title="What we know">
      <p className="text-sm text-ink-2 mb-3">
        The home's fact file — everything the record has picked up from
        research, emails, conversations, and walkthroughs. It feeds the
        Assistant and the Emergency card. Archive anything wrong or stale.
      </p>
      {active.length === 0 ? (
        <p className="text-[12.5px] text-ink-4 m-0">
          Nothing on file yet — facts arrive as the record gets built.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {shown.map((f) => (
            <li
              key={f.id}
              className="py-2.5 border-t border-line last:border-b flex items-baseline justify-between gap-4 group"
            >
              <span className="min-w-0">
                <span className="text-sm text-ink">{f.text}</span>
                <span className="block text-[11px] text-ink-3 mt-0.5">
                  {f.category ? `${f.category} · ` : ""}
                  {SOURCE_LABEL[f.source] || f.source || "on the record"}
                  {f.date ? ` · ${f.date}` : ""}
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs text-ink-3 hover:text-status-critical opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => update(f.id, { archived: true })}
              >
                archive
              </button>
            </li>
          ))}
        </ul>
      )}
      {active.length > 8 && (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-800"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer" : `Show all ${active.length}`}
        </button>
      )}
    </Card>
  )
}
