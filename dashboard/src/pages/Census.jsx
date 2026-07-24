import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { assetCompleteness, missingSystems, featureFuel, censusSummary } from "../recordCensus"
import { Card, PageHeader, StatTile, Button } from "../components"

// Founder-only: the live-record census. Scores every registry asset on
// the fields downstream intelligence consumes, lists what a complete
// profile of this home should hold but doesn't, and shows which roadmap
// features have their trigger data in the tank today. "Copy summary"
// produces the paste-back block that grounds roadmap scoring.

export default function Census() {
  const { uid } = useOutletContext()
  const { items: systems } = useItems(uid, "healthReport")
  const { items: jobs } = useItems(uid, "jobHistory")
  const { items: warranties } = useItems(uid, "warranties")
  const { items: facts } = useItems(uid, "facts")
  const { items: photos } = useItems(uid, "photos")
  const { items: careCalendar } = useItems(uid, "careCalendar")

  const record = { systems, jobs, warranties, facts, photos, careCalendar }
  const scored = systems
    .map((s) => ({ s, ...assetCompleteness(s, record) }))
    .sort((a, b) => a.score - b.score)
  const avg = scored.length
    ? Math.round(scored.reduce((t, x) => t + x.score, 0) / scored.length)
    : 0
  const missing = missingSystems(systems)
  const fuel = featureFuel(record)

  // The guided fill session, batched by capture path.
  const photoFills = missing.filter((m) => m.capture.includes("photo"))
  const questionFills = missing.filter((m) => m.capture.includes("question"))

  const [copied, setCopied] = useState(false)
  async function copySummary() {
    try {
      await navigator.clipboard.writeText(censusSummary(record))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* clipboard unavailable — the tables above hold the same data */
    }
  }

  return (
    <div>
      <PageHeader
        title="Record census"
        subtitle="The registry scored field-by-field against what the intelligence layer needs, and what a complete profile of this home should hold but doesn't."
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatTile label="Assets on registry" value={systems.length} sub="Tracked systems" />
        <StatTile label="Avg completeness" value={`${avg}/100`} sub="Weighted by what features consume" />
        <StatTile label="Not yet registered" value={missing.length} sub="Expected for this home class" />
      </div>

      <div className="mb-4">
        <Button variant="subtle" onClick={copySummary}>
          {copied ? "Copied ✓" : "Copy census summary"}
        </Button>
      </div>

      {missing.length > 0 && (
        <Card title={`Missing from the registry (${missing.length})`} className="mb-4">
          <p className="text-xs text-ink-3 mb-2">
            Systems and appliances a home like this has that the record doesn't know exist.
            The fill session below captures them without typing.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <li
                key={m.label}
                className="text-xs bg-plane border border-line rounded-full px-2.5 py-1 text-ink-2"
              >
                {m.label} <span className="text-ink-3">· {m.capture}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-2 mt-3">
            <span className="font-medium">One guided session:</span> {photoFills.length} nameplate
            photo{photoFills.length === 1 ? "" : "s"} + {questionFills.length} walkthrough
            question{questionFills.length === 1 ? "" : "s"} fills every gap above.
          </p>
        </Card>
      )}

      <Card title="Asset completeness" className="mb-4">
        {scored.length === 0 ? (
          <p className="text-sm text-ink-2">No systems on the registry yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {scored.map(({ s, score, missing: gaps }) => (
              <li key={s.id} className="py-2 text-sm flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{s.category}</span>
                  {gaps.length > 0 && (
                    <span className="block text-xs text-ink-3 mt-0.5">
                      missing: {gaps.join(", ")}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    score >= 70 ? "text-brand-700" : score >= 40 ? "text-amber-700" : "text-status-critical"
                  }`}
                >
                  {score}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Feature fuel — is the trigger data in the tank?">
        <ul className="divide-y divide-line">
          {fuel.map((f) => (
            <li key={f.feature} className="py-2 text-sm flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium text-ink">{f.feature}</span>
                <span className="block text-xs text-ink-3 mt-0.5">
                  needs {f.needs} — has {f.have}
                </span>
              </span>
              <span
                className={`shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${
                  f.ready ? "bg-brand-100 text-brand-800" : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {f.ready ? "Ready" : "Needs fill"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
