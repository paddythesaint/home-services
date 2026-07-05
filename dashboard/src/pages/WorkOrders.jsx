import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import {
  subscribeContractors,
  fetchMemberProperties,
  addItem,
  updateItem,
  removeItem,
} from "../firestoreApi"
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
} from "../workOrders"
import { todayLabel } from "../dates"
import { Card, PageHeader, Button, Modal, DynamicForm, StatTile } from "../components"

// The operational spine: every open piece of work across the portfolio on
// one board — who's doing it, where the quote stands, when it happens.
// Completion writes the Job History entry and resolves the linked priority.

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

  // Completion: the handshake with the rest of the record.
  async function complete() {
    const w = completing
    await addItem(w.propertyId, "jobHistory", jobFromWorkOrder(w))
    if (w.priorityId) {
      await updateItem(w.propertyId, "priorityList", w.priorityId, {
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
                      <p className="text-xs text-ink-3 flex items-center gap-2">
                        {w.propertyLabel}
                        {w.source === "homeowner" && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-50 border border-amber-200 text-amber-900 rounded-full px-2 py-0.5">
                            Client request
                          </span>
                        )}
                      </p>
                      <p className="text-sm font-semibold text-ink mt-0.5">{w.title}</p>
                      <p className="text-xs text-ink-2 mt-1">
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
                          "Our visit"
                        ) : (
                          "Unassigned"
                        )}
                        {w.scheduledFor && ` · ${w.scheduledFor}`}
                        {w.lane === "done" && w.completedOn && ` · done ${w.completedOn}`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <QuoteChip w={w} />
                      </div>
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
            {completing.priorityId ? ", and its linked priority is resolved" : ""}.
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
