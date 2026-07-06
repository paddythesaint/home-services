import { Link, useOutletContext, useParams } from "react-router-dom"
import { useItems } from "../useItems"
import { tradeForItem, tradeForText } from "../trades"
import { replacementHorizon, fmtMoneyRange } from "../benchmarks"
import { isOpenWorkOrder } from "../workOrders"
import {
  Card,
  PageHeader,
  ConditionBadge,
  VerifiedBadge,
  StatusBadge,
  UrgencyBadge,
} from "../components"

// The system dossier: everything the record knows about one system —
// and everything in its trade's orbit — on a single page. The answer to
// "what's the full story on my heating?" without visiting six pages.
export default function SystemProfile() {
  const { uid } = useOutletContext()
  const { systemId } = useParams()
  const { items: systems, loading } = useItems(uid, "healthReport")
  const { items: jobs } = useItems(uid, "jobHistory")
  const { items: priorities } = useItems(uid, "priorityList")
  const { items: calendar } = useItems(uid, "careCalendar")
  const { items: workOrders } = useItems(uid, "workOrders")
  const { items: facts } = useItems(uid, "facts")
  const { items: photos } = useItems(uid, "photos")
  const { items: documents } = useItems(uid, "documents")

  const system = systems.find((s) => s.id === systemId)

  if (!system) {
    return (
      <div>
        <PageHeader
          title={loading ? "Loading…" : "System not found"}
          subtitle={loading ? "" : "It may have been removed."}
        />
        <Link to="/health-report" className="text-sm text-brand-600 underline">
          &larr; Back to the Health Report
        </Link>
      </div>
    )
  }

  const trade = tradeForItem(system)
  const inTrade = (item) => tradeForItem(item).key === trade.key

  const systemPhotos = photos.filter((p) => p.systemId === system.id)
  const relatedJobs = jobs.filter(inTrade).slice().reverse()
  const openPriorities = priorities.filter(
    (p) => (!p.status || p.status === "open" || p.status === "scheduled") && inTrade(p)
  )
  const openOrders = workOrders.filter((w) => isOpenWorkOrder(w) && inTrade(w))
  const tasks = calendar.filter(inTrade)
  const relatedFacts = facts.filter(
    (f) => inTrade(f) || tradeForText(f.text).key === trade.key
  )
  const relatedDocs = documents.filter((d) => tradeForText(d.name).key === trade.key)
  const horizon = replacementHorizon(system)

  return (
    <div>
      <p className="mb-3">
        <Link
          to="/health-report"
          className="text-sm font-medium text-brand-600 hover:text-brand-800"
        >
          &larr; Health Report
        </Link>
      </p>
      <PageHeader
        title={system.category}
        subtitle={[
          system.detail,
          trade.label !== system.category && `Trade: ${trade.label}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <span className="flex flex-col items-end gap-1.5">
            <ConditionBadge condition={system.condition} />
            <VerifiedBadge verified={system.verified} />
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-4">
          <Card title="The record">
            <ul className="text-sm text-ink-2 flex flex-col gap-1.5">
              {system.brand && (
                <li>
                  <span className="text-ink-3">Make/model: </span>
                  {system.brand}
                </li>
              )}
              {system.installYear && (
                <li>
                  <span className="text-ink-3">Installed: </span>
                  {system.installYear}
                </li>
              )}
              {system.serial && (
                <li>
                  <span className="text-ink-3">Serial: </span>
                  {system.serial}
                </li>
              )}
              {system.location && (
                <li>
                  <span className="text-ink-3">Location: </span>
                  {system.location}
                </li>
              )}
              {system.nextDue && (
                <li>
                  <span className="text-ink-3">Next check due: </span>
                  {system.nextDue}
                </li>
              )}
              {system.note && <li className="pt-1">{system.note}</li>}
            </ul>
            {horizon && (
              <p
                className={`text-xs mt-3 pt-3 border-t border-line ${
                  horizon.status === "in-window" || horizon.status === "past"
                    ? "text-amber-800"
                    : "text-ink-3"
                }`}
              >
                Year {horizon.age} of a typical {horizon.benchmark.lifeYears[0]}–
                {horizon.benchmark.lifeYears[1]} · replacement window {horizon.windowStart}–
                {horizon.windowEnd} · ~
                {fmtMoneyRange(horizon.benchmark.replaceCost, horizon.benchmark.costUnit)}
              </p>
            )}
          </Card>

          {relatedFacts.length > 0 && (
            <Card title="Learned along the way">
              <ul className="flex flex-col gap-2">
                {relatedFacts.map((f) => (
                  <li key={f.id} className="text-sm text-ink-2">
                    {f.text}
                    {f.date && <span className="text-xs text-ink-3"> · {f.date}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {systemPhotos.length > 0 && (
            <Card title={`Photos (${systemPhotos.length})`}>
              <div className="grid grid-cols-3 gap-2">
                {systemPhotos.map((p) => (
                  <img
                    key={p.id}
                    src={p.dataUrl}
                    alt={p.caption || system.category}
                    className="rounded-lg object-cover aspect-square w-full"
                  />
                ))}
              </div>
            </Card>
          )}

          {relatedDocs.length > 0 && (
            <Card title="Documents">
              <ul className="divide-y divide-line">
                {relatedDocs.map((d) => (
                  <li key={d.id} className="py-1.5 text-sm text-ink-2 truncate">
                    {d.name}
                    {d.uploadedOn && <span className="text-xs text-ink-3"> · {d.uploadedOn}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          {(openPriorities.length > 0 || openOrders.length > 0) && (
            <Card title="Open right now">
              <ul className="divide-y divide-line">
                {openOrders.map((w) => (
                  <li key={`wo-${w.id}`} className="py-2 flex items-start justify-between gap-3">
                    <span className="text-sm text-ink">
                      {w.title}
                      <span className="text-xs text-ink-3"> · work order — {w.lane}</span>
                    </span>
                    {w.scheduledFor && (
                      <span className="text-xs text-ink-3 shrink-0">{w.scheduledFor}</span>
                    )}
                  </li>
                ))}
                {openPriorities.map((p) => (
                  <li key={`pri-${p.id}`} className="py-2 flex items-start justify-between gap-3">
                    <span className="text-sm text-ink">
                      {p.title}
                      <span className="text-xs text-ink-3"> · priority</span>
                    </span>
                    <UrgencyBadge urgency={p.urgency} />
                  </li>
                ))}
              </ul>
              <Link
                to="/priority-list"
                className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
              >
                Manage on the 90-Day list &rarr;
              </Link>
            </Card>
          )}

          {tasks.length > 0 && (
            <Card title="On the care calendar">
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li key={t.id} className="py-1.5 text-sm text-ink-2">
                    <span className="font-medium text-ink">{t.month}</span> — {t.task}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Work on this system (${relatedJobs.length})`}>
            {relatedJobs.length === 0 ? (
              <p className="text-sm text-ink-3">
                No jobs on record yet for {trade.label.toLowerCase()}.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {relatedJobs.map((j) => (
                  <li key={j.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{j.title}</p>
                      <p className="text-xs text-ink-3">
                        {[j.date, j.sub].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={j.status} />
                      {j.cost && <p className="text-xs text-ink-2 mt-1">{j.cost}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
