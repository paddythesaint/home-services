import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { fetchMemberProperties } from "../firestoreApi"
import { todayISO, isoToLabel, todayLabel } from "../dates"
import { Card, PageHeader, StatTile, UrgencyBadge, Button } from "../components"

const isOpen = (p) => !p.status || p.status === "open" || p.status === "scheduled"

// One property's live rollup. Reports its metrics up so the portfolio tiles
// can sum across properties, and renders its own actionable priority queue.
function OpsProperty({ propertyId, profile, onMetrics, onContractors }) {
  const priorityApi = useItems(propertyId, "priorityList")
  const { items: systems } = useItems(propertyId, "healthReport")
  const { items: jobs } = useItems(propertyId, "jobHistory")

  const openPriorities = priorityApi.items.filter(isOpen)
  const highPriorities = openPriorities.filter((p) => p.urgency === "high")
  const overdueChecks = systems.filter((s) => s.nextDue && s.nextDue <= todayISO())
  const urgentSystems = systems.filter((s) => s.condition === "urgent")
  const scheduledJobs = jobs.filter((j) => j.status === "scheduled")

  useEffect(() => {
    onMetrics(propertyId, {
      open: openPriorities.length,
      high: highPriorities.length,
      overdue: overdueChecks.length,
      urgent: urgentSystems.length,
      scheduled: scheduledJobs.length,
    })
  }, [
    propertyId,
    openPriorities.length,
    highPriorities.length,
    overdueChecks.length,
    urgentSystems.length,
    scheduledJobs.length,
  ])

  useEffect(() => {
    const names = [...new Set(jobs.map((j) => j.sub).filter((s) => s && s !== "—" && !s.startsWith("TBD")))]
    onContractors(propertyId, names)
  }, [propertyId, jobs])

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-ink">{profile.address}</p>
          <p className="text-xs text-ink-3">
            {profile.areaLabel}
            {profile.clientName ? ` · ${profile.clientName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-xs text-ink-2">
          <span>{openPriorities.length} open</span>
          {overdueChecks.length > 0 && (
            <span className="text-status-critical">{overdueChecks.length} overdue</span>
          )}
          {urgentSystems.length > 0 && (
            <span className="text-status-critical">{urgentSystems.length} urgent</span>
          )}
          {scheduledJobs.length > 0 && <span>{scheduledJobs.length} scheduled</span>}
        </div>
      </div>

      {openPriorities.length === 0 ? (
        <p className="text-sm text-ink-3">No open items.</p>
      ) : (
        <ul className="divide-y divide-line">
          {openPriorities
            .slice()
            .sort((a, b) => rank(b.urgency) - rank(a.urgency))
            .map((p) => (
              <li key={p.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {p.title}
                    {p.status === "scheduled" && (
                      <span className="ml-2 text-xs font-normal text-blue-700">Scheduled</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-3">{p.category}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <UrgencyBadge urgency={p.urgency} />
                  {p.status !== "scheduled" && (
                    <button
                      type="button"
                      className="text-xs text-ink-3 hover:text-ink"
                      onClick={() => priorityApi.update(p.id, { status: "scheduled" })}
                    >
                      Schedule
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-ink-3 hover:text-ink"
                    onClick={() =>
                      priorityApi.update(p.id, {
                        status: "resolved",
                        resolvedOn: todayLabel(),
                        resolutionNote: "Resolved from ops",
                      })
                    }
                  >
                    Done
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </Card>
  )
}

function rank(u) {
  return u === "high" ? 3 : u === "medium" ? 2 : 1
}

export default function Ops() {
  const { user } = useOutletContext()
  const [state, setState] = useState({ status: "loading", list: [] })
  const [metrics, setMetrics] = useState({})
  const [contractors, setContractors] = useState({})

  useEffect(() => {
    let active = true
    fetchMemberProperties(user.email)
      .then((list) => active && setState({ status: "ready", list }))
      .catch(() => active && setState({ status: "error", list: [] }))
    return () => {
      active = false
    }
  }, [user.email])

  const totals = Object.values(metrics).reduce(
    (acc, m) => ({
      open: acc.open + m.open,
      high: acc.high + m.high,
      overdue: acc.overdue + m.overdue,
      urgent: acc.urgent + m.urgent,
    }),
    { open: 0, high: 0, overdue: 0, urgent: 0 }
  )

  const allContractors = [...new Set(Object.values(contractors).flat())].sort()

  return (
    <div>
      <PageHeader
        title="Operations"
        subtitle="Internal portfolio view across the properties you manage. Actions here update the same records owners see."
      />

      {state.status === "loading" ? (
        <Card>
          <p className="text-sm text-ink-2">Loading portfolio…</p>
        </Card>
      ) : state.list.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">No properties in your portfolio yet.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatTile label="Properties" value={state.list.length} sub="In your portfolio" />
            <StatTile label="Open priorities" value={totals.open} sub={`${totals.high} high urgency`} />
            <StatTile label="Overdue checks" value={totals.overdue} sub="Recurring verifications" />
            <StatTile label="Urgent systems" value={totals.urgent} sub="Need attention now" />
          </div>

          <div className="flex flex-col gap-4">
            {state.list.map((p) => (
              <OpsProperty
                key={p.id}
                propertyId={p.id}
                profile={p}
                onMetrics={(id, m) => setMetrics((prev) => ({ ...prev, [id]: m }))}
                onContractors={(id, names) =>
                  setContractors((prev) => ({ ...prev, [id]: names }))
                }
              />
            ))}
          </div>

          <div className="mt-4">
            <Card title="Contractors in the network">
              {allContractors.length === 0 ? (
                <p className="text-sm text-ink-3">
                  No contractors captured yet — they'll appear here as jobs are logged.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {allContractors.map((name) => (
                      <span
                        key={name}
                        className="text-sm text-ink-2 bg-brand-100 rounded-full px-3 py-1"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-ink-3 mt-3">
                    Pulled from job history. Promoting these to full contractor
                    records (trades, phone, jobs, sourcing) is the next step.
                  </p>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      <p className="text-xs text-ink-3 mt-4">
        Portfolio is scoped to properties you're a member of.{" "}
        <Link to="/" className="underline">
          Back to the homeowner view
        </Link>
        .
      </p>
    </div>
  )
}
