import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { fetchMemberProperties } from "../firestoreApi"
import { todayISO, isoToLabel, todayLabel } from "../dates"
import { isReadyToAction } from "../resolution"
import { Card, PageHeader, StatTile, UrgencyBadge, ConditionBadge } from "../components"

const isOpen = (p) => !p.status || p.status === "open" || p.status === "scheduled"
const rank = (u) => (u === "high" ? 3 : u === "medium" ? 2 : 1)

// One property's live rollup. Reports metrics + attention items up so the
// command center can aggregate across the portfolio, and renders its own
// actionable queue.
function OpsProperty({ propertyId, profile, onMetrics, onAttention, onContractors }) {
  const priorityApi = useItems(propertyId, "priorityList")
  const { items: systems } = useItems(propertyId, "healthReport")
  const { items: jobs } = useItems(propertyId, "jobHistory")

  const openPriorities = priorityApi.items.filter(isOpen)
  const highPriorities = openPriorities.filter((p) => p.urgency === "high")
  const readyPriorities = openPriorities.filter(isReadyToAction)
  const nextVisitPriorities = openPriorities.filter(
    (p) => p.resolutionPath === "subscription-visit"
  )
  const overdueChecks = systems.filter((s) => s.nextDue && s.nextDue <= todayISO())
  const urgentSystems = systems.filter((s) => s.condition === "urgent")
  const scheduledJobs = jobs.filter((j) => j.status === "scheduled")
  const completedJobs = jobs.filter((j) => j.status === "completed")

  useEffect(() => {
    onMetrics(propertyId, {
      open: openPriorities.length,
      high: highPriorities.length,
      ready: readyPriorities.length,
      nextVisit: nextVisitPriorities.length,
      overdue: overdueChecks.length,
      urgent: urgentSystems.length,
      scheduled: scheduledJobs.length,
      completed: completedJobs.length,
    })
  }, [
    propertyId,
    openPriorities.length,
    highPriorities.length,
    readyPriorities.length,
    nextVisitPriorities.length,
    overdueChecks.length,
    urgentSystems.length,
    scheduledJobs.length,
    completedJobs.length,
  ])

  // High-urgency open priorities + overdue checks feed the cross-portfolio
  // "needs attention now" list.
  useEffect(() => {
    const items = [
      ...highPriorities.map((p) => ({
        key: `p-${p.id}`,
        kind: "priority",
        title: p.title,
        urgency: p.urgency,
        property: profile.address,
      })),
      ...overdueChecks.map((s) => ({
        key: `c-${s.id}`,
        kind: "check",
        title: `${s.category} check overdue (${isoToLabel(s.nextDue)})`,
        urgency: "high",
        property: profile.address,
      })),
    ]
    onAttention(propertyId, items)
  }, [propertyId, highPriorities, overdueChecks, profile.address])

  useEffect(() => {
    const names = [
      ...new Set(
        jobs.map((j) => j.sub).filter((s) => s && s !== "—" && !s.startsWith("TBD"))
      ),
    ]
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
          {readyPriorities.length > 0 && <span>{readyPriorities.length} ready</span>}
          {nextVisitPriorities.length > 0 && (
            <span>{nextVisitPriorities.length} next visit</span>
          )}
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
                        resolutionNote: "Resolved from command center",
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

export default function Ops() {
  const { user } = useOutletContext()
  const [state, setState] = useState({ status: "loading", list: [] })
  const [metrics, setMetrics] = useState({})
  const [attention, setAttention] = useState({})
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
    (a, m) => ({
      open: a.open + m.open,
      high: a.high + m.high,
      ready: a.ready + (m.ready || 0),
      nextVisit: a.nextVisit + (m.nextVisit || 0),
      overdue: a.overdue + m.overdue,
      urgent: a.urgent + m.urgent,
      scheduled: a.scheduled + m.scheduled,
      completed: a.completed + m.completed,
    }),
    { open: 0, high: 0, ready: 0, nextVisit: 0, overdue: 0, urgent: 0, scheduled: 0, completed: 0 }
  )

  const attentionFeed = Object.values(attention).flat().sort((a, b) => rank(b.urgency) - rank(a.urgency))
  const allContractors = [...new Set(Object.values(contractors).flat())].sort()

  return (
    <div>
      <PageHeader
        title="Business"
        subtitle="Command center for running the service — portfolio health, demand, and what needs action across every property. Internal financials and client health arrive as a separate founder-only layer."
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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
            <StatTile label="Properties" value={state.list.length} sub="Under management" />
            <StatTile
              label="Open work"
              value={totals.open}
              sub={`${totals.high} high · ${totals.ready} ready · ${totals.nextVisit} next visit`}
            />
            <StatTile label="Overdue checks" value={totals.overdue} sub="SLA risk" />
            <StatTile label="Urgent systems" value={totals.urgent} sub="Needs attention" />
            <StatTile label="Scheduled" value={totals.scheduled} sub="Jobs in flight" />
            <StatTile label="Completed" value={totals.completed} sub="Jobs all-time" />
          </div>

          <div className="mb-4">
            <Card title="Needs attention now">
              {attentionFeed.length === 0 ? (
                <p className="text-sm text-ink-3">
                  Nothing urgent across the portfolio — high-urgency work and overdue
                  checks would surface here.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {attentionFeed.map((item) => (
                    <li key={item.key} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="text-xs text-ink-3">{item.property}</p>
                      </div>
                      <span className="shrink-0">
                        {item.kind === "check" ? (
                          <ConditionBadge condition="urgent" />
                        ) : (
                          <UrgencyBadge urgency={item.urgency} />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <h2 className="text-sm font-semibold text-ink-2 mb-2">By property</h2>
          <div className="flex flex-col gap-4">
            {state.list.map((p) => (
              <OpsProperty
                key={p.id}
                propertyId={p.id}
                profile={p}
                onMetrics={(id, m) => setMetrics((prev) => ({ ...prev, [id]: m }))}
                onAttention={(id, items) => setAttention((prev) => ({ ...prev, [id]: items }))}
                onContractors={(id, names) => setContractors((prev) => ({ ...prev, [id]: names }))}
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
                    Pulled from job history. Manage full records — trades, phone, sourcing,
                    jobs — on each property's{" "}
                    <Link to="/contractors" className="underline">
                      Contractors
                    </Link>{" "}
                    page.
                  </p>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      <p className="text-xs text-ink-3 mt-4">
        Scoped to properties you're a member of.{" "}
        <Link to="/" className="underline">
          Back to the homeowner view
        </Link>
        .
      </p>
    </div>
  )
}
