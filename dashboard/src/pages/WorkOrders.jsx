import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import {
  subscribeContractors,
  fetchMemberProperties,
  fetchItems,
  addItem,
  updateItem,
  removeItem,
} from "../firestoreApi"
import { callClaude } from "../backendApi"
import { viewFor } from "../roles"
import { PropertyCollectionFeed } from "../PortfolioJobs"
import {
  LANES,
  LANE_META,
  ASSIGNEE_TYPES,
  ASSIGNEE_LABEL,
  QUOTE_STATUSES,
  QUOTE_LABEL,
  nextLane,
  isOpenWorkOrder,
  jobFromWorkOrder,
  linkedPriorityIds,
  ageSummary,
} from "../workOrders"
import { briefingSystemPrompt, briefingMessages } from "../workOrderBriefing"
import { todayLabel } from "../dates"
import { Card, PageHeader, Button, Modal, DynamicForm, StatTile } from "../components"

// The operational spine: every open piece of work across the portfolio on
// one board — who's doing it, where the quote stands, when it happens.
// Completion writes the Job History entry and resolves the linked priority.

// The ticket detail: a slide-over (bottom sheet on mobile) that turns a
// card headline into the whole story — the client's own words, the
// timeline, the workflow state, and a briefing the ops lead can read off
// the home's record before dispatching anyone.
function WorkOrderDrawer({ w, properties, onClose, onEdit, onDelete, onAdvance }) {
  const [briefing, setBriefing] = useState("idle") // idle | loading | error
  const next = nextLane(w.lane)

  async function generate() {
    setBriefing("loading")
    try {
      const [systems, priorities, jobs, facts] = await Promise.all([
        fetchItems(w.propertyId, "healthReport"),
        fetchItems(w.propertyId, "priorityList"),
        fetchItems(w.propertyId, "jobHistory"),
        fetchItems(w.propertyId, "facts"),
      ])
      const property = properties.find((p) => p.id === w.propertyId) || {}
      const system = briefingSystemPrompt({
        profile: property,
        systems,
        priorities,
        jobs,
        workOrders: [],
        facts,
        order: w,
      })
      const data = await callClaude(w.propertyId, system, briefingMessages())
      const text = data.content?.find((b) => b.type === "text")?.text || ""
      await updateItem(w.propertyId, "workOrders", w.id, {
        aiSummary: text,
        aiSummaryOn: todayLabel(),
      })
      setBriefing("idle")
    } catch {
      setBriefing("error")
    }
  }

  const requester =
    w.source === "homeowner"
      ? `${w.requestedBy || "the client"}${w.via === "assistant" ? " · via assistant" : " · via Request button"}`
      : "Filed by the team"

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Work order details">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl md:rounded-t-none md:inset-y-0 md:right-0 md:left-auto md:w-[30rem] md:max-h-none bg-surface shadow-xl flex flex-col">
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-line">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                {LANE_META[w.lane]?.label || w.lane}
              </span>
              {w.source === "homeowner" && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-50 border border-amber-200 text-amber-900 rounded-full px-2 py-0.5">
                  Client request
                </span>
              )}
            </div>
            <h2 className="font-display text-lg font-semibold text-ink mt-1 leading-snug">{w.title}</h2>
            <p className="text-xs text-ink-3 mt-0.5">{w.propertyLabel}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-plane text-lg"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          <p className="text-xs text-ink-2">{ageSummary(w)}</p>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-1.5">
              {w.source === "homeowner" ? "What the client said" : "The request"}
            </h3>
            {w.notes ? (
              <blockquote className="text-sm text-ink whitespace-pre-line border-l-2 border-brand-400 pl-3 py-0.5">
                {w.notes}
              </blockquote>
            ) : (
              <p className="text-sm text-ink-3">No detail was captured on the request.</p>
            )}
            <p className="text-xs text-ink-3 mt-1.5">— {requester}</p>
          </section>

          <section>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                AI briefing
              </h3>
              {w.aiSummary && briefing !== "loading" && (
                <button
                  type="button"
                  onClick={generate}
                  className="text-xs font-medium text-brand-600 hover:text-brand-800"
                >
                  Regenerate
                </button>
              )}
            </div>
            {w.aiSummary ? (
              <>
                <p className="text-sm text-ink-2 whitespace-pre-line bg-plane rounded-xl px-3.5 py-3">
                  {w.aiSummary}
                </p>
                {w.aiSummaryOn && (
                  <p className="text-[11px] text-ink-3 mt-1">
                    From the home's record · {w.aiSummaryOn}
                  </p>
                )}
              </>
            ) : briefing === "loading" ? (
              <p className="text-sm text-ink-3 animate-pulse">Reading the home's record…</p>
            ) : (
              <div>
                <p className="text-sm text-ink-3 mb-2">
                  Pull what we know about this home and the system involved — likely causes,
                  history, and the right trade — before dispatching.
                </p>
                <Button variant="subtle" onClick={generate}>
                  Generate briefing
                </Button>
                {briefing === "error" && (
                  <p className="text-sm text-status-critical mt-2">
                    Couldn't reach the briefing service — try again.
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-1.5">
              Workflow
            </h3>
            <dl className="text-sm grid grid-cols-[7rem_1fr] gap-y-1.5">
              <dt className="text-ink-3">Assigned</dt>
              <dd className="text-ink">
                {w.assigneeType === "contractor" ? (
                  w.contractorId ? (
                    <Link
                      to={`/contractor-network/${w.contractorId}`}
                      className="text-brand-600 hover:text-brand-800"
                    >
                      {w.contractorName || "Contractor"}
                    </Link>
                  ) : (
                    "Contractor TBD"
                  )
                ) : w.assigneeType === "visit" ? (
                  "Our visit (in-house)"
                ) : (
                  "Unassigned"
                )}
              </dd>
              <dt className="text-ink-3">Quote</dt>
              <dd className="text-ink">
                {QUOTE_LABEL[w.quoteStatus] || "—"}
                {w.quoteAmount ? ` · ${w.quoteAmount}` : ""}
              </dd>
              <dt className="text-ink-3">Category</dt>
              <dd className="text-ink">{w.category || "—"}</dd>
              {w.scheduledFor && (
                <>
                  <dt className="text-ink-3">Scheduled</dt>
                  <dd className="text-ink">{w.scheduledFor}</dd>
                </>
              )}
            </dl>
          </section>
        </div>

        <div className="shrink-0 border-t border-line px-5 py-3 flex items-center gap-3">
          {next && (
            <Button onClick={onAdvance}>
              {next === "done" ? "Mark done" : `→ ${LANE_META[next].label}`}
            </Button>
          )}
          <Button variant="subtle" onClick={onEdit}>
            Edit
          </Button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-ink-3 hover:text-red-600 ml-auto"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function QuoteChip({ w }) {
  if (!w.quoteStatus || w.quoteStatus === "none") return null
  const label =
    w.quoteStatus === "received" || w.quoteStatus === "approved"
      ? `${QUOTE_LABEL[w.quoteStatus]}${w.quoteAmount ? ` · ${w.quoteAmount}` : ""}`
      : QUOTE_LABEL[w.quoteStatus]
  const tone =
    w.quoteStatus === "approved"
      ? "bg-brand-100 text-brand-900"
      : "bg-amber-50 text-amber-900 border border-amber-200"
  return <span className={`inline-block text-xs font-medium rounded-full px-2 py-0.5 ${tone}`}>{label}</span>
}

export default function WorkOrders() {
  const { user } = useOutletContext()
  const founder = viewFor(user?.email).business

  const [properties, setProperties] = useState([])
  const [byProperty, setByProperty] = useState({})
  const [contractors, setContractors] = useState([])
  const [editing, setEditing] = useState(null) // work order being edited
  const [creating, setCreating] = useState(false)
  const [createFor, setCreateFor] = useState("")
  const [completing, setCompleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [detailKey, setDetailKey] = useState(null) // {propertyId, id} of open drawer

  useEffect(() => {
    if (!founder) return
    let active = true
    fetchMemberProperties(user.email).then((list) => {
      if (!active) return
      setProperties(list)
      setCreateFor((cur) => cur || list[0]?.id || "")
    })
    return () => {
      active = false
    }
  }, [founder, user?.email])

  useEffect(() => {
    if (!founder) return
    return subscribeContractors(setContractors, () => {})
  }, [founder])

  if (!founder) {
    return (
      <div>
        <PageHeader title="Work Orders" subtitle="Business owners only." />
        <Card>
          <p className="text-sm text-ink-2">
            This is the business-side work pipeline.{" "}
            <Link to="/" className="underline">
              Back to the homeowner view
            </Link>
            .
          </p>
        </Card>
      </div>
    )
  }

  const all = Object.values(byProperty)
    .flat()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
  const open = all.filter(isOpenWorkOrder)

  // The drawer tracks the order by key, then reads the live copy from the
  // feed — so a briefing generated inside it (or a lane advance) shows up
  // immediately without stale props.
  const detail = detailKey
    ? all.find((w) => w.propertyId === detailKey.propertyId && w.id === detailKey.id) || null
    : null

  const fields = [
    { name: "title", label: "What needs doing", type: "text" },
    { name: "category", label: "Category", type: "text", placeholder: "e.g. Exterior, HVAC" },
    {
      name: "assigneeType",
      label: "Who does it",
      type: "select",
      options: ["", ...ASSIGNEE_TYPES],
      optionLabels: { "": "— undecided —", ...ASSIGNEE_LABEL },
    },
    {
      name: "contractorId",
      label: "Contractor (network)",
      type: "select",
      options: ["", ...contractors.map((c) => c.id)],
      optionLabels: {
        "": "— none yet —",
        ...Object.fromEntries(contractors.map((c) => [c.id, c.name])),
      },
    },
    {
      name: "quoteStatus",
      label: "Quote",
      type: "select",
      options: QUOTE_STATUSES,
      optionLabels: QUOTE_LABEL,
    },
    { name: "quoteAmount", label: "Quote amount", type: "text", placeholder: "e.g. $1,450" },
    { name: "scheduledFor", label: "Scheduled for", type: "text", placeholder: "e.g. July 12, 2026" },
    { name: "notes", label: "Notes", type: "textarea" },
  ]

  function withContractorName(values) {
    const c = contractors.find((x) => x.id === values.contractorId)
    return {
      ...values,
      contractorName: c ? c.name : "",
      ...(values.contractorId ? { assigneeType: "contractor" } : {}),
    }
  }

  async function saveEdit(values) {
    await updateItem(editing.propertyId, "workOrders", editing.id, withContractorName(values))
    setEditing(null)
  }

  async function saveNew(values) {
    await addItem(createFor, "workOrders", {
      lane: "triage",
      createdOn: todayLabel(),
      priorityId: "",
      ...withContractorName(values),
    })
    setCreating(false)
  }

  async function advance(w) {
    const lane = nextLane(w.lane)
    if (!lane) return
    if (lane === "done") {
      setCompleting(w)
      return
    }
    await updateItem(w.propertyId, "workOrders", w.id, { lane })
  }

  // Completion: the handshake with the rest of the record. A bundled order
  // resolves every priority it was raised to close, not just one.
  async function complete() {
    const w = completing
    await addItem(w.propertyId, "jobHistory", jobFromWorkOrder(w))
    for (const pid of linkedPriorityIds(w)) {
      await updateItem(w.propertyId, "priorityList", pid, {
        status: "resolved",
        resolvedOn: todayLabel(),
        resolutionNote: `Closed by work order${w.contractorName ? ` — ${w.contractorName}` : ""}`,
      })
    }
    await updateItem(w.propertyId, "workOrders", w.id, {
      lane: "done",
      completedOn: todayLabel(),
    })
    setCompleting(null)
  }

  return (
    <div>
      {properties.map((p) => (
        <PropertyCollectionFeed
          key={p.id}
          propertyId={p.id}
          propertyLabel={p.address}
          collection="workOrders"
          onItems={(pid, list) => setByProperty((prev) => ({ ...prev, [pid]: list }))}
        />
      ))}

      <PageHeader
        title="Work Orders"
        subtitle="Every piece of work across the portfolio: who does it, where the quote stands, when it happens."
        action={<Button onClick={() => setCreating(true)}>+ New work order</Button>}
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatTile label="Open orders" value={open.length} sub="Across the portfolio" />
        <StatTile
          label="Waiting on quotes"
          value={open.filter((w) => ["needed", "requested"].includes(w.quoteStatus)).length}
          sub="Needed or requested"
        />
        <StatTile
          label="On the calendar"
          value={open.filter((w) => w.lane === "scheduled" || w.lane === "in-progress").length}
          sub="Scheduled + in progress"
        />
      </div>

      <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="grid grid-flow-col auto-cols-[270px] gap-3 min-w-max">
          {LANES.map((lane) => {
            const laneOrders = all.filter((w) => w.lane === lane)
            return (
              <div key={lane} className="bg-plane border border-line rounded-2xl p-2.5">
                <p className="px-1.5 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {LANE_META[lane].label}
                  <span className="font-normal normal-case tracking-normal">
                    {" "}
                    · {laneOrders.length === 0 ? LANE_META[lane].hint : laneOrders.length}
                  </span>
                </p>
                <div className="flex flex-col gap-2">
                  {laneOrders.map((w) => (
                    <div
                      key={`${w.propertyId}-${w.id}`}
                      className="bg-surface border border-line rounded-xl p-3 shadow-(--shadow-card)"
                    >
                      <button
                        type="button"
                        onClick={() => setDetailKey({ propertyId: w.propertyId, id: w.id })}
                        className="w-full text-left group"
                        title="Open ticket details"
                      >
                        <p className="text-xs text-ink-3 flex items-center gap-2">
                          {w.propertyLabel}
                          {w.source === "homeowner" && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-50 border border-amber-200 text-amber-900 rounded-full px-2 py-0.5">
                              Client request
                            </span>
                          )}
                        </p>
                        <p className="text-sm font-semibold text-ink mt-0.5 group-hover:text-brand-700">
                          {w.title}
                        </p>
                        <p className="text-xs text-ink-2 mt-1">
                          {w.assigneeType === "contractor"
                            ? w.contractorName || "Contractor TBD"
                            : w.assigneeType === "visit"
                              ? "Our visit"
                              : "Unassigned"}
                          {w.scheduledFor && ` · ${w.scheduledFor}`}
                          {w.lane === "done" && w.completedOn && ` · done ${w.completedOn}`}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <QuoteChip w={w} />
                        </div>
                      </button>
                      <div className="mt-2 pt-2 border-t border-line flex items-center gap-3 text-xs">
                        {lane !== "done" && (
                          <button
                            type="button"
                            className="font-medium text-brand-600 hover:text-brand-800"
                            onClick={() => advance(w)}
                          >
                            {nextLane(lane) === "done"
                              ? "Mark done"
                              : `→ ${LANE_META[nextLane(lane)].label}`}
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-ink-3 hover:text-ink"
                          onClick={() => setEditing(w)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-ink-3 hover:text-red-600 ml-auto"
                          onClick={() => setConfirmDelete(w)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-ink-3 mt-3">
        Raise orders from the 90-Day Priorities page to keep them linked — completing a linked
        order resolves its priority and writes the job to Job History automatically.
      </p>

      {detail && (
        <WorkOrderDrawer
          w={detail}
          properties={properties}
          onClose={() => setDetailKey(null)}
          onEdit={() => {
            setDetailKey(null)
            setEditing(detail)
          }}
          onDelete={() => {
            setDetailKey(null)
            setConfirmDelete(detail)
          }}
          onAdvance={() => {
            if (nextLane(detail.lane) === "done") setDetailKey(null)
            advance(detail)
          }}
        />
      )}

      {creating && (
        <Modal title="New work order" onClose={() => setCreating(false)}>
          <label className="flex flex-col gap-1 text-sm mb-4">
            <span className="font-medium text-ink-2">Property</span>
            <select
              className="border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink"
              value={createFor}
              onChange={(e) => setCreateFor(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                </option>
              ))}
            </select>
          </label>
          <DynamicForm fields={fields} initialValues={{ quoteStatus: "none" }} onSubmit={saveNew} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit work order" onClose={() => setEditing(null)}>
          <p className="text-xs text-ink-3 mb-3">{editing.propertyLabel}</p>
          <DynamicForm fields={fields} initialValues={editing} onSubmit={saveEdit} />
        </Modal>
      )}

      {completing && (
        <Modal title="Mark done?" onClose={() => setCompleting(null)}>
          <p className="text-sm text-ink-2 mb-4">
            "{completing.title}" at {completing.propertyLabel} gets written to Job History
            {completing.quoteAmount ? ` at ${completing.quoteAmount}` : ""}
            {(() => {
              const n = linkedPriorityIds(completing).length
              return n === 1
                ? ", and its linked priority is resolved"
                : n > 1
                  ? `, and its ${n} linked priorities are resolved`
                  : ""
            })()}
            .
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button onClick={complete}>Complete work order</Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete work order?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{confirmDelete.title}"? Job History and priorities are not changed —
            completed work stays on the record.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await removeItem(confirmDelete.propertyId, "workOrders", confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
