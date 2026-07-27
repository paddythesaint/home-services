import { useEffect, useState } from "react"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import {
  fetchMemberProperties,
  createProperty,
  deletePropertyDeep,
  fetchLatestTouch,
  updateItem,
} from "../firestoreApi"
import { todayISO, isoToLabel, todayLabel } from "../dates"
import { isReadyToAction } from "../resolution"
import { detectIssues, escalationCeiling } from "../issuePlaybook"
import { coverageAlerts, coverageStatus, expiryLine } from "../warranties"
import { workOrderAttention } from "../attentionInbox"
import { capitalEvents, capitalPhrase, CAPITAL_STATUS_WORD } from "../capitalPlanning"
import { viewFor } from "../roles"
import SystemStatus from "../SystemStatus"
import {
  Card,
  PageHeader,
  Figure,
  FigureRow,
  UrgencyBadge,
  ConditionBadge,
  Button,
  Modal,
  DynamicForm,
} from "../components"

const newPropertyFields = [
  { name: "address", label: "Address", type: "text" },
  { name: "areaLabel", label: "City / State / Zip", type: "text" },
  { name: "clientName", label: "Family / client name", type: "text" },
  { name: "tier", label: "Membership tier", type: "text", placeholder: "e.g. Standard" },
  { name: "monthlyRate", label: "Monthly rate ($)", type: "number" },
  { name: "yearBuilt", label: "Year built", type: "number" },
  { name: "acreage", label: "Acreage", type: "number" },
  { name: "bedrooms", label: "Bedrooms", type: "number" },
  { name: "bathrooms", label: "Bathrooms", type: "number" },
]

const isOpen = (p) => !p.status || p.status === "open" || p.status === "scheduled"
const rank = (u) => (u === "high" ? 3 : u === "medium" ? 2 : 1)


// One property's live rollup. Reports metrics + attention items up so the
// command center can aggregate across the portfolio, and renders its own
// actionable queue.
function OpsProperty({
  propertyId,
  profile,
  onMetrics,
  onAttention,
  onContractors,
  onOrders = () => {},
  onCapital = () => {},
  onRecalls = () => {},
  onOpen,
}) {
  const priorityApi = useItems(propertyId, "priorityList")
  const { items: systems } = useItems(propertyId, "healthReport")
  const { items: jobs } = useItems(propertyId, "jobHistory")
  const { items: warranties } = useItems(propertyId, "warranties")
  const { items: workOrders } = useItems(propertyId, "workOrders")
  const { items: recallFindings } = useItems(propertyId, "recallFindings")

  // Relationship health, not just property health: when did we last talk
  // to this household? (Founder-only clients store; errors stay quiet.)
  const [lastTouch, setLastTouch] = useState(null)
  useEffect(() => {
    let active = true
    fetchLatestTouch(propertyId)
      .then((t) => active && setLastTouch(t))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [propertyId])

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

  // Escalation exposure: what the open priorities calcify into if deferred,
  // summed across this home's detected issue clusters (Phase-2 intelligence).
  const clusters = detectIssues(priorityApi.items)
  const riskCeiling = clusters.reduce((s, c) => s + escalationCeiling(c.issue), 0)

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
      clusters: clusters.length,
      riskCeiling,
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
    clusters.length,
    riskCeiling,
  ])

  // The attention inbox: workflow items (client requests, undecided quotes,
  // stalled orders) plus the record-side alerts (high priorities, overdue
  // checks, expiring coverage) — everything that needs a human now, with a
  // destination to act on it.
  useEffect(() => {
    const items = [
      ...workOrderAttention(workOrders).map((a) => ({
        ...a,
        property: profile.address,
        propertyId,
        // Straight into the order's drawer — not the board it lives on.
        to: a.workOrderId ? `/work-orders?order=${a.workOrderId}` : "/work-orders",
      })),
      ...highPriorities.map((p) => ({
        key: `p-${p.id}`,
        kind: "priority",
        title: p.title,
        urgency: p.urgency,
        property: profile.address,
        propertyId,
        to: "/priority-list",
        propertyScoped: true,
      })),
      ...overdueChecks.map((s) => ({
        key: `c-${s.id}`,
        kind: "check",
        title: `${s.category} check overdue (${isoToLabel(s.nextDue)})`,
        urgency: "high",
        property: profile.address,
        propertyId,
        to: "/health-report",
        propertyScoped: true,
      })),
      // Coverage about to lapse (or already lapsed) is exactly the kind of
      // thing that only surfaces when it's too late — so it rides the same
      // cross-portfolio attention feed.
      ...coverageAlerts(warranties).map((w) => ({
        key: `w-${w.id}`,
        kind: "coverage",
        title: `${w.item} — ${expiryLine(w).toLowerCase()}`,
        urgency: coverageStatus(w) === "expired" ? "high" : "medium",
        property: profile.address,
        propertyId,
        to: "/coverage",
        propertyScoped: true,
      })),
    ]
    onAttention(propertyId, items)
    // Depend on the stable subscription arrays, not the derived filters —
    // fresh .filter() identities every render would re-fire this effect
    // (and re-set parent state) on every single render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, priorityApi.items, systems, warranties, workOrders, profile.address])

  // Lift the raw orders too — the 3a pipeline reads lanes across the
  // whole portfolio. Same stable-array dependency rule as above.
  useEffect(() => {
    onOrders(
      propertyId,
      workOrders.map((w) => ({ ...w, property: profile.address }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, workOrders, profile.address])

  // Capital horizon: systems approaching / inside / past their replacement
  // window. Planning fuel, not fire-fighting — it gets its own card, not
  // the attention inbox.
  useEffect(() => {
    onCapital(
      propertyId,
      capitalEvents(systems).map((e) => ({ ...e, property: profile.address, propertyId }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, systems, profile.address])

  // Recall watch: weekly CPSC scan output, founder-reviewed here before
  // any homeowner hears about it.
  useEffect(() => {
    onRecalls(
      propertyId,
      recallFindings
        .filter((f) => f.status !== "dismissed")
        .map((f) => ({ ...f, property: profile.address, propertyId }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, recallFindings, profile.address])

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
            {lastTouch ? ` · last touch ${lastTouch.date}` : " · no touches logged"}
          </p>
          {onOpen && (
            <button
              type="button"
              className="text-xs text-brand-600 hover:text-brand-800 font-medium mt-1"
              onClick={() => onOpen(propertyId)}
            >
              View dashboard &rarr;
            </button>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-xs text-ink-2">
          {systems.length > 0 && (
            <span>
              {systems.filter((s) => s.condition === "good").length}/{systems.length} systems
              good
            </span>
          )}
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
  const { user, setActiveProperty, refreshPortfolio } = useOutletContext()
  const navigate = useNavigate()
  const founder = viewFor(user?.email).business
  const [state, setState] = useState({ status: "loading", list: [] })
  const [metrics, setMetrics] = useState({})
  const [attention, setAttention] = useState({})
  const [contractors, setContractors] = useState({})
  const [orders, setOrders] = useState({})
  const [capital, setCapital] = useState({})
  const [recalls, setRecalls] = useState({})
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [deleting, setDeleting] = useState(null) // property pending delete confirmation
  const [confirmText, setConfirmText] = useState("")
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    let active = true
    fetchMemberProperties(user.email)
      .then((list) => active && setState({ status: "ready", list }))
      .catch(() => active && setState({ status: "error", list: [] }))
    return () => {
      active = false
    }
  }, [user.email])

  // Jump the Property-plane pages to one home from the portfolio view.
  function openProperty(id) {
    setActiveProperty?.(id)
    navigate("/")
  }

  // Inbox rows navigate to where you act. Property-scoped destinations
  // (priorities, health, coverage) first switch the active property so the
  // page opens on the right home; portfolio pages (work orders) go direct.
  function openAttention(item) {
    if (item.propertyScoped && item.propertyId) setActiveProperty?.(item.propertyId)
    navigate(item.to || "/work-orders")
  }

  async function doDelete() {
    setDeleteBusy(true)
    setDeleteError("")
    try {
      await deletePropertyDeep(deleting.id)
      const drop = (setter) =>
        setter((prev) => {
          const next = { ...prev }
          delete next[deleting.id]
          return next
        })
      drop(setMetrics)
      drop(setAttention)
      drop(setContractors)
      setState((s) => ({ ...s, list: s.list.filter((p) => p.id !== deleting.id) }))
      await refreshPortfolio?.()
      setDeleting(null)
      setConfirmText("")
    } catch (err) {
      setDeleteError(`Couldn't delete: ${err.message || err}`)
    }
    setDeleteBusy(false)
  }

  async function submitNewProperty(values) {
    setCreateError("")
    try {
      const id = await createProperty(values, user)
      // Refresh before switching so the switcher recognizes the new id.
      await refreshPortfolio?.()
      setActiveProperty?.(id)
      setCreating(false)
      navigate("/")
    } catch (err) {
      const denied = (err.code || "").includes("permission-denied")
      setCreateError(
        denied
          ? "Permission denied — the property-creation rule isn't published yet. Publish dashboard/firestore.rules in the Firebase console (see RUNBOOK.md), then try again."
          : `Couldn't create the property: ${err.message || err}`
      )
    }
  }

  // The Command Center is the business owners' plane. Members who land
  // here by URL get a polite pointer home instead of the whole operation.
  if (!founder) {
    return (
      <div>
        <PageHeader title="Command Center" subtitle="Business owners only." />
        <Card>
          <p className="text-sm text-ink-2">
            This is the business side of the operation and isn't part of your property
            record.{" "}
            <Link to="/" className="underline">
              Back to your home's dashboard
            </Link>
            .
          </p>
        </Card>
      </div>
    )
  }

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
      clusters: a.clusters + (m.clusters || 0),
      riskCeiling: a.riskCeiling + (m.riskCeiling || 0),
    }),
    {
      open: 0,
      high: 0,
      ready: 0,
      nextVisit: 0,
      overdue: 0,
      urgent: 0,
      scheduled: 0,
      completed: 0,
      clusters: 0,
      riskCeiling: 0,
    }
  )

  const attentionFeed = Object.values(attention).flat().sort((a, b) => rank(b.urgency) - rank(a.urgency))
  const allContractors = [...new Set(Object.values(contractors).flat())].sort()

  // 3a voice: the page opens with what needs a human, not a department name.
  const n = attentionFeed.length
  const NUM_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
  const headline =
    n === 0
      ? "Nothing needs you today."
      : `${NUM_WORDS[n] || n} thing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} you today.`

  return (
    <div>
      <PageHeader
        title={headline}
        clause={n === 0 ? "All quiet across the portfolio." : "Sorted by urgency."}
        action={
          founder ? (
            <Button onClick={() => setCreating(true)}>+ New property</Button>
          ) : undefined
        }
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
          {/* 3a business figures — five, hairline-ruled, ink rule on the lead. */}
          <div className="mb-8">
            <FigureRow cols={5}>
              <Figure lead value={state.list.length} label="properties under management" />
              <Figure
                value={totals.open}
                label={`open work · ${totals.high} high · ${totals.ready} ready`}
              />
              <Figure
                value={totals.riskCeiling > 0 ? `$${totals.riskCeiling.toLocaleString("en-US")}` : "—"}
                label={`at risk if deferred · ${totals.clusters} cluster${totals.clusters === 1 ? "" : "s"}`}
              />
              <Figure value={totals.overdue} label="overdue checks" />
              <Figure value={totals.urgent} label="urgent systems" />
            </FigureRow>
          </div>

          <div className="mb-4">
            <Card
              title={`Attention inbox${attentionFeed.length > 0 ? ` (${attentionFeed.length})` : ""}`}
            >
              {attentionFeed.length === 0 ? (
                <p className="text-sm text-ink-3">
                  Inbox zero — new client requests, undecided quotes, stalled orders,
                  high-urgency work, overdue checks, and lapsing coverage all surface here.
                </p>
              ) : (
                <ul className="m-0 p-0 list-none">
                  {/* 3a rows: dot · what · where · act. Color never alone —
                      the badge keeps the word next to the severity dot. */}
                  {attentionFeed.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => openAttention(item)}
                        className="w-full grid grid-cols-[12px_1.9fr_1fr_auto] items-center gap-3 py-2.5 text-left border-t border-line group hover:bg-ink/[0.02]"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            background:
                              item.kind === "check" || item.urgency === "high"
                                ? "var(--color-status-critical)"
                                : item.urgency === "medium"
                                  ? "var(--color-status-warn)"
                                  : "var(--color-status-idle)",
                          }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink truncate group-hover:text-brand-700">
                            {item.title}
                          </span>
                          {item.detail && (
                            <span className="block text-[12.5px] text-ink-3 truncate">{item.detail}</span>
                          )}
                        </span>
                        <span className="text-[12.5px] text-ink-3 truncate">{item.property}</span>
                        <span className="shrink-0 flex items-center gap-2.5">
                          {item.kind === "check" ? (
                            <ConditionBadge condition="urgent" />
                          ) : (
                            <UrgencyBadge urgency={item.urgency} />
                          )}
                          <span className="text-[12.5px] text-brand-700">Open →</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Capital horizon: the big-ticket replacements coming across the
              portfolio, most pressing first. Planning fuel — the trigger for
              a proactive conversation, deliberately apart from the inbox. */}
          {(() => {
            const feed = Object.values(capital).flat()
            if (feed.length === 0) return null
            return (
              <div className="mb-4">
                <Card title={`Capital horizon (${feed.length})`}>
                  <ul className="m-0 p-0 list-none">
                    {feed.map((e) => (
                      <li
                        key={`cap-${e.propertyId}-${e.system.id}`}
                        className="grid grid-cols-[12px_1fr_auto] items-baseline gap-3 py-2.5 border-t border-line"
                      >
                        <span
                          className="w-2 h-2 rounded-full self-center"
                          style={{
                            background:
                              e.horizon.status === "past"
                                ? "var(--color-status-critical)"
                                : e.horizon.status === "in-window"
                                  ? "var(--color-status-warn)"
                                  : "var(--color-status-good)",
                          }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">
                            {e.system.category}
                            <span className="font-normal text-ink-3"> · {e.property}</span>
                          </span>
                          <span className="block text-[12.5px] leading-[1.55] text-ink-2">
                            {capitalPhrase(e)}
                          </span>
                        </span>
                        <span className="numeric text-[10.5px] uppercase tracking-wide text-ink-3 shrink-0">
                          {CAPITAL_STATUS_WORD[e.horizon.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-ink-3 mt-3">
                    Only systems with an install year can be placed — every nameplate the
                    census fill adds joins this view.
                  </p>
                </Card>
              </div>
            )
          })()}

          {/* Recall watch: CPSC matches on registered brands. The founder
              decides what reaches the homeowner — Dismiss buries a finding
              for good (re-scans never resurrect it). */}
          {(() => {
            const feed = Object.values(recalls).flat()
            if (feed.length === 0) return null
            return (
              <div className="mb-4">
                <Card title={`Recall watch (${feed.length})`}>
                  <ul className="m-0 p-0 list-none">
                    {feed.map((f) => (
                      <li
                        key={`rc-${f.propertyId}-${f.id}`}
                        className="grid grid-cols-[12px_1fr_auto] items-baseline gap-3 py-2.5 border-t border-line"
                      >
                        <span
                          className="w-2 h-2 rounded-full self-center"
                          style={{ background: "var(--color-status-critical)" }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">
                            {f.systemCategory} · {f.brand}
                            <span className="font-normal text-ink-3"> · {f.property}</span>
                          </span>
                          <span className="block text-[12.5px] leading-[1.55] text-ink-2">
                            {f.title}
                            {f.hazard && ` — ${f.hazard.toLowerCase()} hazard`}
                            {f.date && ` (${f.date})`}
                          </span>
                        </span>
                        <span className="shrink-0 flex items-baseline gap-3">
                          {f.url && (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[12.5px] text-brand-700 hover:text-brand-800"
                            >
                              CPSC notice →
                            </a>
                          )}
                          <button
                            type="button"
                            className="text-xs text-ink-3 hover:text-ink"
                            onClick={() =>
                              updateItem(f.propertyId, "recallFindings", f.id, {
                                status: "dismissed",
                              })
                            }
                          >
                            Dismiss
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-ink-3 mt-3">
                    Scanned weekly against CPSC recalls for every brand on the registry.
                    Verify the model on the notice before raising it with the homeowner.
                  </p>
                </Card>
              </div>
            )
          })()}

          {/* 3a pipeline: five headed hairline lists, no card chrome. The
              lanes read across the whole portfolio; rows link to the board. */}
          {(() => {
            const allOrders = Object.values(orders).flat()
            const LANES = [
              ["triage", "Triage"],
              ["quote", "Quoting"],
              ["scheduled", "Scheduled"],
              ["in-progress", "In progress"],
              ["done", "Recently done"],
            ]
            if (allOrders.length === 0) return null
            return (
              <div className="mb-8">
                <p className="eyebrow m-0 mb-3.5">Pipeline</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-5">
                  {LANES.map(([lane, label], i) => {
                    const list =
                      lane === "done"
                        ? allOrders.filter((w) => w.lane === "done").slice(-4).reverse()
                        : allOrders.filter((w) => w.lane === lane)
                    return (
                      <div key={lane} className={`pt-2.5 border-t ${i === 0 ? "border-rule" : "border-line-2"}`}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[12.5px] font-medium text-ink">{label}</span>
                          <span className="numeric text-[11px] text-ink-3">{list.length}</span>
                        </div>
                        <ul className="m-0 mt-2 p-0 list-none">
                          {list.map((w) => (
                            <li key={`${w.propertyId || w.property}-${w.id}`} className="border-b border-line py-2">
                              <Link to={`/work-orders?order=${w.id}`} className="block group">
                                <span className="block text-[12.5px] text-ink leading-snug group-hover:text-brand-700">
                                  {w.title}
                                </span>
                                <span className="numeric block text-[10.5px] text-ink-3 mt-0.5">
                                  {[
                                    (w.property || "").split(" ")[0],
                                    w.quoteAmount || null,
                                    w.scheduledFor || null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </span>
                              </Link>
                            </li>
                          ))}
                          {list.length === 0 && (
                            <li className="text-[11px] text-ink-4 py-2">empty</li>
                          )}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

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
                onOrders={(id, list) => setOrders((prev) => ({ ...prev, [id]: list }))}
                onCapital={(id, list) => setCapital((prev) => ({ ...prev, [id]: list }))}
                onRecalls={(id, list) => setRecalls((prev) => ({ ...prev, [id]: list }))}
                onOpen={founder ? openProperty : undefined}
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
                    {allContractors.map((name) =>
                      founder ? (
                        <Link
                          key={name}
                          to="/contractor-network"
                          className="text-sm text-ink-2 bg-brand-100 rounded-full px-3 py-1 hover:bg-brand-200"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span
                          key={name}
                          className="text-sm text-ink-2 bg-brand-100 rounded-full px-3 py-1"
                        >
                          {name}
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-xs text-ink-3 mt-3">
                    Pulled from job history.{" "}
                    {founder ? (
                      <>
                        Manage the full network — contacts, cadence, cross-property jobs —
                        in the{" "}
                        <Link to="/contractor-network" className="underline">
                          Contractor Network
                        </Link>
                        .
                      </>
                    ) : (
                      <>
                        Manage full records — trades, phone, sourcing, jobs — on each
                        property's{" "}
                        <Link to="/contractors" className="underline">
                          Contractors
                        </Link>{" "}
                        page.
                      </>
                    )}
                  </p>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      {founder && (
        <div className="mt-4">
          <Card title="System map">
            <p className="text-sm text-ink-2">
              An interactive map of how the platform fits together — every data store, the
              intelligence engines that read them, and the pages they feed. Handy for walking a
              teammate through what's built and how it works.
            </p>
            <Link
              to="/system-map"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
            >
              Open the system map
              <span aria-hidden="true">→</span>
            </Link>
          </Card>
        </div>
      )}

      {founder && state.status === "ready" && state.list.length > 0 && (
        <div className="mt-4">
          <Card title="Portfolio admin">
            <p className="text-sm text-ink-2">
              Founder-only housekeeping. Member access (adding or removing people) is
              managed on each property's Overview under "People with access" — this is
              where whole properties are removed.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {state.list.map((p) => (
                <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{p.address}</p>
                    <p className="text-xs text-ink-3">
                      {[p.areaLabel, `${(p.members || []).length} member${(p.members || []).length === 1 ? "" : "s"}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => setDeleting(p)}>
                    Delete…
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {founder && (
        <div className="mt-4">
          <SystemStatus user={user} />
          <Card title="Record census" className="mt-4">
            <p className="text-sm text-ink-2">
              Back-office QA: how complete the selected home's registry is, what a home of
              its class should have that the record doesn't, and which intelligence features
              have their trigger data. Run it on every new home at onboarding.{" "}
              <Link to="/census" className="text-brand-700 underline hover:text-brand-900">
                Open the census →
              </Link>
            </p>
          </Card>
        </div>
      )}

      <p className="text-xs text-ink-3 mt-4">
        Scoped to properties you're a member of.{" "}
        <Link to="/" className="underline">
          Back to the homeowner view
        </Link>
        .
      </p>

      {deleting && (
        <Modal
          title="Delete property?"
          onClose={() => {
            setDeleting(null)
            setConfirmText("")
            setDeleteError("")
          }}
        >
          <p className="text-sm text-ink-2 mb-3">
            This permanently deletes <strong>{deleting.address}</strong> and everything in
            its record — systems, priorities, calendar, jobs, photos, activity, and its
            vendor roster. Members lose access immediately. There is no undo.
          </p>
          <label className="block text-sm mb-4">
            <span className="text-ink-2">
              Type the address to confirm: <strong>{deleting.address}</strong>
            </span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1.5 w-full border border-line rounded-lg px-3 py-2 bg-surface text-ink"
              placeholder={deleting.address}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              variant="subtle"
              onClick={() => {
                setDeleting(null)
                setConfirmText("")
                setDeleteError("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteBusy || confirmText.trim() !== deleting.address}
              onClick={doDelete}
            >
              {deleteBusy ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
          {deleteError && <p className="text-sm text-red-600 mt-3">{deleteError}</p>}
        </Modal>
      )}

      {creating && (
        <Modal title="New property" onClose={() => setCreating(false)}>
          <p className="text-sm text-ink-2 mb-4">
            Creates the property record with you as its first member. Invite the
            homeowner afterward from the property's "People with access" panel.
          </p>
          <DynamicForm
            fields={newPropertyFields}
            initialValues={{ tier: "Standard" }}
            submitLabel="Create property"
            onSubmit={submitNewProperty}
          />
          {createError && <p className="text-sm text-red-600 mt-3">{createError}</p>}
        </Modal>
      )}
    </div>
  )
}
