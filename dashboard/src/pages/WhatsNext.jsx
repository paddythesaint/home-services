// "What's Next": one answer to "what's happening at my house?" — the
// merged timeline the plan pages each show a slice of. In-flight work,
// this month's care and checks, and the 90-day queue, every item linked
// to the page (or the system) that explains it. The other plan pages
// survive as lenses behind the tabs.

import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { isUnderway } from "../workOrders"
import { todayISO, isoToLabel } from "../dates"
import { PlanTabs } from "../HubTabs"
import { Card, PageHeader, UrgencyBadge, StatusBadge } from "../components"

function Row({ children, right }) {
  return (
    <li className="py-2.5 flex items-start justify-between gap-3">
      <div className="min-w-0">{children}</div>
      {right && <div className="shrink-0">{right}</div>}
    </li>
  )
}

export default function WhatsNext() {
  const { uid, profile } = useOutletContext()
  const { items: systems } = useItems(uid, "healthReport")
  const { items: calendar } = useItems(uid, "careCalendar")
  const { items: priorities } = useItems(uid, "priorityList")
  const { items: jobs } = useItems(uid, "jobHistory")
  const { items: workOrders } = useItems(uid, "workOrders")

  const inFlight = workOrders.filter(isUnderway)
  const month = new Date().toLocaleDateString("en-US", { month: "long" })
  const monthTasks = calendar.filter((t) => t.month === month)
  const dueChecks = systems
    .filter((s) => s.nextDue && s.nextDue <= todayISO())
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
  const scheduledJobs = jobs.filter((j) => j.status === "scheduled")
  const openPriorities = priorities.filter(
    (p) => !p.status || p.status === "open" || p.status === "scheduled"
  )

  const allQuiet =
    inFlight.length === 0 &&
    monthTasks.length === 0 &&
    dueChecks.length === 0 &&
    scheduledJobs.length === 0 &&
    openPriorities.length === 0

  return (
    <div>
      <PlanTabs />
      <PageHeader
        title="What's Next"
        subtitle={`Everything coming up at ${profile.address} — in-flight work, this month's care, and the 90-day queue, in one place.`}
      />

      {allQuiet && (
        <Card>
          <p className="text-sm text-ink-2">
            All quiet — nothing in flight, nothing due. That's the goal.
          </p>
        </Card>
      )}

      {inFlight.length > 0 && (
        <Card title="Happening now" className="mb-4">
          <ul className="divide-y divide-line">
            {inFlight.map((w) => (
              <Row
                key={w.id}
                right={
                  <span className="text-xs text-ink-3">
                    {w.lane === "in-progress"
                      ? "being worked on"
                      : w.scheduledFor
                        ? `scheduled ${w.scheduledFor}`
                        : "on the calendar"}
                  </span>
                }
              >
                <p className="text-sm font-medium text-ink">{w.title}</p>
              </Row>
            ))}
          </ul>
        </Card>
      )}

      {(dueChecks.length > 0 || monthTasks.length > 0 || scheduledJobs.length > 0) && (
        <Card title={`This month (${month})`} className="mb-4">
          <ul className="divide-y divide-line">
            {dueChecks.map((s) => (
              <Row
                key={s.id}
                right={<span className="text-xs text-status-critical">check due</span>}
              >
                <Link
                  to={`/system/${s.id}`}
                  className="text-sm font-medium text-ink hover:text-brand-700"
                >
                  {s.category}
                </Link>
                <p className="text-xs text-ink-3">
                  recurring check was due {isoToLabel(s.nextDue)}
                </p>
              </Row>
            ))}
            {monthTasks.map((t) => (
              <Row key={t.id} right={<span className="text-xs text-ink-3">care task</span>}>
                <Link
                  to="/care-calendar"
                  className="text-sm font-medium text-ink hover:text-brand-700"
                >
                  {t.task}
                </Link>
              </Row>
            ))}
            {scheduledJobs.map((j) => (
              <Row key={j.id} right={<StatusBadge status={j.status} />}>
                <Link
                  to="/job-history"
                  className="text-sm font-medium text-ink hover:text-brand-700"
                >
                  {j.title}
                </Link>
                <p className="text-xs text-ink-3">
                  {j.date}
                  {j.sub ? ` · ${j.sub}` : ""}
                </p>
              </Row>
            ))}
          </ul>
        </Card>
      )}

      {openPriorities.length > 0 && (
        <Card title="Next 90 days" className="mb-4">
          <ul className="divide-y divide-line">
            {openPriorities.slice(0, 6).map((p) => (
              <Row key={p.id} right={<UrgencyBadge urgency={p.urgency} />}>
                <Link
                  to="/priority-list"
                  className="text-sm font-medium text-ink hover:text-brand-700"
                >
                  {p.title}
                </Link>
                {p.category && <p className="text-xs text-ink-3">{p.category}</p>}
              </Row>
            ))}
          </ul>
          {openPriorities.length > 6 && (
            <Link
              to="/priority-list"
              className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
            >
              View all {openPriorities.length} priorities &rarr;
            </Link>
          )}
        </Card>
      )}
    </div>
  )
}
