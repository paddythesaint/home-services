import { useState } from "react"
import { PlanTabs } from "../HubTabs"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { addItem } from "../firestoreApi"
import { todayLabel } from "../dates"
import { viewFor } from "../roles"
import { workOrderFromPriority, workOrderFromBundle } from "../workOrders"
import { suggestRequirements } from "../requirementSuggestions"
import { groupByTrade, tradeForItem } from "../trades"
import { findDuplicates } from "../issuePlaybook"
import IssueInsights from "../IssueInsights"
import {
  RESOLUTION_PATHS,
  PATH_META,
  MATERIAL_STATUSES,
  MATERIAL_STATUS_LABEL,
  INFO_TYPES,
  isOpenPriority,
  materialSatisfied,
  infoSatisfied,
  openRequirements,
  requirementId,
  resolutionCounts,
  visitManifest,
  quoteBundles,
} from "../resolution"
import {
  Card,
  PageHeader,
  UrgencyBadge,
  StatTile,
  Button,
  Modal,
  DynamicForm,
} from "../components"

const fields = [
  { name: "title", label: "Title", type: "text" },
  { name: "category", label: "Category", type: "text" },
  { name: "reason", label: "Reason", type: "textarea" },
  { name: "estCost", label: "Estimated cost", type: "text", placeholder: "e.g. $150 – $350" },
  {
    name: "urgency",
    label: "Urgency",
    type: "select",
    options: ["high", "medium", "low"],
    optionLabels: { high: "High", medium: "Medium", low: "Low" },
  },
]

const DISPOSITION_LABEL = {
  scheduled: "Scheduled",
  resolved: "Resolved",
  dismissed: "Dismissed",
}

function ReadinessChip({ item }) {
  const open = openRequirements(item)
  return open.count === 0 ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 whitespace-nowrap">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: "var(--color-status-good)" }}
        aria-hidden="true"
      />
      Ready to action
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 whitespace-nowrap">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: "var(--color-status-warn)" }}
        aria-hidden="true"
      />
      {open.count} needed to close
    </span>
  )
}

const inputClass =
  "border border-line rounded-lg px-2 py-1 bg-surface text-ink text-xs focus:outline-none focus:border-brand-400"

// The closeout block on each open priority: how it gets actioned, and what
// (materials / info) is still needed before it can be closed.
function ResolutionSection({ item, update }) {
  const [addingMaterial, setAddingMaterial] = useState(false)
  const [addingInfo, setAddingInfo] = useState(false)
  const [matName, setMatName] = useState("")
  const [matSpec, setMatSpec] = useState("")
  const [infoAsk, setInfoAsk] = useState("")
  const [infoType, setInfoType] = useState("fact")
  const [providing, setProviding] = useState(null) // info requirement id
  const [answer, setAnswer] = useState("")
  const [bundleDraft, setBundleDraft] = useState(item.bundleTag || "")

  const materials = item.materialsNeeded || []
  const info = item.infoNeeded || []
  const suggestions = suggestRequirements(item)

  function addSuggestedMaterial(s) {
    update(item.id, {
      materialsNeeded: [
        ...materials,
        { id: requirementId(), item: s.item, spec: s.spec || "", status: "needed" },
      ],
    })
  }

  function addSuggestedInfo(s) {
    update(item.id, {
      infoNeeded: [
        ...info,
        { id: requirementId(), ask: s.ask, type: s.type || "fact", status: "open" },
      ],
    })
  }

  function saveMaterial() {
    if (!matName.trim()) return
    update(item.id, {
      materialsNeeded: [
        ...materials,
        { id: requirementId(), item: matName.trim(), spec: matSpec.trim(), status: "needed" },
      ],
    })
    setMatName("")
    setMatSpec("")
    setAddingMaterial(false)
  }

  function saveInfo() {
    if (!infoAsk.trim()) return
    update(item.id, {
      infoNeeded: [
        ...info,
        { id: requirementId(), ask: infoAsk.trim(), type: infoType, status: "open" },
      ],
    })
    setInfoAsk("")
    setInfoType("fact")
    setAddingInfo(false)
  }

  function cycleMaterial(m) {
    const next =
      MATERIAL_STATUSES[(MATERIAL_STATUSES.indexOf(m.status) + 1) % MATERIAL_STATUSES.length]
    update(item.id, {
      materialsNeeded: materials.map((x) => (x.id === m.id ? { ...x, status: next } : x)),
    })
  }

  function provideInfo(i) {
    update(item.id, {
      infoNeeded: info.map((x) =>
        x.id === i.id ? { ...x, status: "provided", answer: answer.trim() } : x
      ),
    })
    setProviding(null)
    setAnswer("")
  }

  return (
    <div className="mt-3 pt-3 border-t border-line">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-3">How it gets done:</span>
          <select
            className={inputClass}
            value={item.resolutionPath || ""}
            onChange={(e) => update(item.id, { resolutionPath: e.target.value })}
          >
            <option value="">— choose —</option>
            {RESOLUTION_PATHS.map((p) => (
              <option key={p} value={p}>
                {PATH_META[p].label}
              </option>
            ))}
          </select>
          {item.resolutionPath === "project-quote" && (
            <input
              className={inputClass}
              placeholder="Bundle (e.g. Exterior package)"
              value={bundleDraft}
              onChange={(e) => setBundleDraft(e.target.value)}
              onBlur={() => update(item.id, { bundleTag: bundleDraft.trim() })}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
          )}
          {item.resolutionPath && (
            <span className="text-xs text-ink-3 hidden md:inline">
              {PATH_META[item.resolutionPath]?.detail}
            </span>
          )}
        </div>
        <ReadinessChip item={item} />
      </div>

      {(materials.length > 0 || info.length > 0) && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => cycleMaterial(m)}
                title="Click to advance: needed → purchased → on the truck"
                className={`shrink-0 rounded-full px-2 py-0.5 font-medium border ${
                  materialSatisfied(m)
                    ? "border-line text-ink-3 bg-brand-100"
                    : "border-amber-300 text-amber-900 bg-amber-50"
                }`}
              >
                {MATERIAL_STATUS_LABEL[m.status] || "Needed"}
              </button>
              <span className={materialSatisfied(m) ? "text-ink-3" : "text-ink-2"}>
                {m.item}
                {m.spec && <span className="text-ink-3"> — {m.spec}</span>}
              </span>
              <button
                type="button"
                aria-label="Remove material"
                className="text-ink-3 hover:text-red-600 ml-auto"
                onClick={() =>
                  update(item.id, { materialsNeeded: materials.filter((x) => x.id !== m.id) })
                }
              >
                &times;
              </button>
            </li>
          ))}
          {info.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-xs flex-wrap">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-medium border ${
                  infoSatisfied(i)
                    ? "border-line text-ink-3 bg-brand-100"
                    : "border-amber-300 text-amber-900 bg-amber-50"
                }`}
              >
                {infoSatisfied(i) ? "Provided" : i.type === "photo" ? "Photo needed" : i.type === "measurement" ? "Measurement needed" : "Info needed"}
              </span>
              <span className={infoSatisfied(i) ? "text-ink-3" : "text-ink-2"}>
                {i.ask}
                {i.answer && <span className="text-ink-3"> — {i.answer}</span>}
              </span>
              {!infoSatisfied(i) &&
                (providing === i.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      autoFocus
                      className={inputClass}
                      placeholder={i.type === "photo" ? "Where is it filed? (optional)" : "Answer"}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && provideInfo(i)}
                    />
                    <button
                      type="button"
                      className="text-brand-600 font-medium hover:text-brand-800"
                      onClick={() => provideInfo(i)}
                    >
                      Save
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-brand-600 font-medium hover:text-brand-800"
                    onClick={() => {
                      setProviding(i.id)
                      setAnswer("")
                    }}
                  >
                    Provide
                  </button>
                ))}
              <button
                type="button"
                aria-label="Remove info requirement"
                className="text-ink-3 hover:text-red-600 ml-auto"
                onClick={() => update(item.id, { infoNeeded: info.filter((x) => x.id !== i.id) })}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      {(suggestions.materials.length > 0 || suggestions.info.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-3">Typically needed for this:</span>
          {suggestions.materials.map((s) => (
            <button
              key={`sm-${s.dedupeKey}`}
              type="button"
              title={s.spec ? `Material — ${s.spec}` : "Material"}
              className="text-xs text-ink-2 border border-dashed border-line rounded-full px-2.5 py-0.5 hover:border-brand-400 hover:text-ink"
              onClick={() => addSuggestedMaterial(s)}
            >
              + {s.item}
            </button>
          ))}
          {suggestions.info.map((s) => (
            <button
              key={`si-${s.dedupeKey}`}
              type="button"
              title={s.type === "photo" ? "Photo ask" : s.type === "measurement" ? "Measurement ask" : "Info ask"}
              className="text-xs text-ink-2 border border-dashed border-line rounded-full px-2.5 py-0.5 hover:border-brand-400 hover:text-ink"
              onClick={() => addSuggestedInfo(s)}
            >
              + {s.ask}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {addingMaterial ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              className={inputClass}
              placeholder="Material / part"
              value={matName}
              onChange={(e) => setMatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveMaterial()}
            />
            <input
              className={inputClass}
              placeholder="Spec / where to buy (optional)"
              value={matSpec}
              onChange={(e) => setMatSpec(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveMaterial()}
            />
            <button
              type="button"
              className="text-xs text-brand-600 font-medium hover:text-brand-800"
              onClick={saveMaterial}
            >
              Add
            </button>
            <button
              type="button"
              className="text-xs text-ink-3 hover:text-ink"
              onClick={() => setAddingMaterial(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="text-xs text-ink-3 hover:text-ink"
            onClick={() => setAddingMaterial(true)}
          >
            + Material needed
          </button>
        )}
        {addingInfo ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <input
              autoFocus
              className={inputClass}
              placeholder="What do we need to know / see?"
              value={infoAsk}
              onChange={(e) => setInfoAsk(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveInfo()}
            />
            <select
              className={inputClass}
              value={infoType}
              onChange={(e) => setInfoType(e.target.value)}
            >
              {INFO_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-xs text-brand-600 font-medium hover:text-brand-800"
              onClick={saveInfo}
            >
              Add
            </button>
            <button
              type="button"
              className="text-xs text-ink-3 hover:text-ink"
              onClick={() => setAddingInfo(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="text-xs text-ink-3 hover:text-ink"
            onClick={() => setAddingInfo(true)}
          >
            + Info needed
          </button>
        )}
      </div>
    </div>
  )
}

export default function PriorityList() {
  const { uid, user } = useOutletContext()
  const founder = viewFor(user?.email).business
  const { items, add, update, remove, moveUp, moveDown } = useItems(uid, "priorityList")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [resolving, setResolving] = useState(null) // item being resolved/dismissed
  // Organizing lens: ranked by urgency (default) or grouped by trade.
  const [grouped, setGrouped] = useState(() => {
    try {
      return localStorage.getItem("groupPriorities") === "1"
    } catch {
      return false
    }
  })
  function toggleGrouped() {
    setGrouped((g) => {
      try {
        localStorage.setItem("groupPriorities", g ? "" : "1")
      } catch {
        /* fine */
      }
      return !g
    })
  }
  const [resolveMode, setResolveMode] = useState("resolved")
  const [resolveNote, setResolveNote] = useState("")

  // Urgency filter: everyone (incl. homeowners) can narrow to just the
  // high / medium / low items. Sticky per device.
  const [urgency, setUrgency] = useState(() => {
    try {
      return localStorage.getItem("priorityUrgency") || "all"
    } catch {
      return "all"
    }
  })
  function pickUrgency(u) {
    setUrgency(u)
    try {
      localStorage.setItem("priorityUrgency", u)
    } catch {
      /* fine */
    }
  }

  const openItems = items.filter(isOpenPriority)
  const shownOpen =
    urgency === "all"
      ? openItems
      : openItems.filter((i) => (i.urgency || "medium") === urgency)
  const closedItems = items.filter((i) => !isOpenPriority(i))
  const counts = resolutionCounts(items)
  const manifest = visitManifest(items)
  const bundles = quoteBundles(items).filter((b) => b.tag !== "Ungrouped" || b.items.length > 1)

  function disposition(item, status) {
    setResolving(item)
    setResolveMode(status)
    setResolveNote("")
  }

  async function confirmDisposition() {
    await update(resolving.id, {
      status: resolveMode,
      resolvedOn: todayLabel(),
      resolutionNote: resolveNote.trim(),
    })
    setResolving(null)
  }

  // One click from "we should fix this" to a tracked piece of work on the
  // Work Orders board, linked both ways.
  async function raiseWorkOrder(item) {
    const ref = await addItem(uid, "workOrders", workOrderFromPriority(item))
    await update(item.id, { workOrderId: ref.id })
  }

  // Phase-2 bundle: one work order that closes a whole issue cluster. Links
  // every priority in the cluster back to the same order so the board (and
  // completion) treat them as one coordinated action.
  async function raiseBundle(issue, clusterItems) {
    const ref = await addItem(uid, "workOrders", workOrderFromBundle(issue, clusterItems))
    await Promise.all(clusterItems.map((p) => update(p.id, { workOrderId: ref.id })))
  }

  return (
    <div>
      <PlanTabs />
      <PageHeader
        title="90-Day Priorities"
        subtitle="Ranked recommendations — and for each one, what's needed to close it out and how it gets done."
        action={<Button onClick={() => setEditing("new")}>+ Add item</Button>}
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatTile label="Open" value={counts.open} sub="Next 90 days" />
        <StatTile
          label="Ready to action"
          value={counts.ready}
          sub="Nothing missing to close"
        />
        <StatTile
          label="Next visit closes"
          value={counts.nextVisit}
          sub="Batched on the subscription"
        />
      </div>

      {viewFor(user?.email).staff &&
        (() => {
          // Same item twice (e.g. re-added by an insights wave after one copy
          // was resolved) — same fuzzy matching as the contractor dedup,
          // applied to open priorities. Closing the newer copy keeps the one
          // with the most history.
          const dupPairs = findDuplicates(openItems)
          if (dupPairs.length === 0) return null
          const byId = Object.fromEntries(openItems.map((p) => [p.id, p]))
          return (
            <Card className="mb-4 border-amber-200 bg-amber-50/40">
              <p className="text-sm font-semibold text-ink mb-1.5">
                Possible duplicate priorities ({dupPairs.length})
              </p>
              <ul className="flex flex-col gap-2">
                {dupPairs.map(([aId, bId]) => {
                  const a = byId[aId]
                  const b = byId[bId]
                  if (!a || !b) return null
                  // The later insert is the likely re-add — offer to close it.
                  const newer = (b.order || 0) >= (a.order || 0) ? b : a
                  const keeper = newer === a ? b : a
                  return (
                    <li key={`${aId}-${bId}`} className="text-sm text-ink-2 flex items-start justify-between gap-3">
                      <span>
                        “{a.title}” and “{b.title}” look like the same item twice.
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-800"
                        onClick={() =>
                          update(newer.id, {
                            status: "resolved",
                            resolvedOn: todayLabel(),
                            resolutionNote: `Duplicate of "${keeper.title}"`,
                          })
                        }
                      >
                        Close the duplicate
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })()}

      {viewFor(user?.email).staff && (
        <IssueInsights priorities={items} onBundle={founder ? raiseBundle : undefined} />
      )}

      {manifest.items.length > 0 && (
        <div className="mb-4">
          <Card title="Next visit manifest">
            <p className="text-xs text-ink-3 mb-2">
              The recurring visit closes {manifest.items.length} item
              {manifest.items.length === 1 ? "" : "s"}
              {manifest.materials.length > 0 && " — pack the truck with the list below"}.
            </p>
            <ul className="divide-y divide-line">
              {manifest.items.map((p) => (
                <li key={p.id} className="py-2 text-sm text-ink flex items-start justify-between gap-3">
                  <span>{p.title}</span>
                  <ReadinessChip item={p} />
                </li>
              ))}
            </ul>
            {manifest.materials.length > 0 && (
              <div className="mt-3 pt-3 border-t border-line">
                <p className="text-xs font-semibold text-ink-2 mb-1.5">Materials list</p>
                <ul className="flex flex-col gap-1">
                  {manifest.materials.map((m) => (
                    <li key={m.id} className="text-xs text-ink-2 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: materialSatisfied(m)
                            ? "var(--color-status-good)"
                            : "var(--color-status-warn)",
                        }}
                        aria-hidden="true"
                      />
                      {m.item}
                      {m.spec && <span className="text-ink-3">— {m.spec}</span>}
                      <span className="text-ink-3 ml-auto">
                        {MATERIAL_STATUS_LABEL[m.status]} · {m.priorityTitle}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}

      {bundles.length > 0 && (
        <div className="mb-4">
          <Card title="Quote packages">
            <p className="text-xs text-ink-3 mb-2">
              Related quotable work grouped so one visit covers it.
            </p>
            <div className="flex flex-col gap-2">
              {bundles.map((b) => (
                <div key={b.tag} className="text-sm">
                  <p className="font-medium text-ink">
                    {b.tag}{" "}
                    <span className="text-xs font-normal text-ink-3">
                      · {b.items.length} item{b.items.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="text-xs text-ink-3">
                    {b.items.map((p) => p.title).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {openItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-line bg-plane p-0.5 text-xs">
            {[
              ["all", "All"],
              ["high", "High"],
              ["medium", "Medium"],
              ["low", "Low"],
            ].map(([key, label]) => {
              const n =
                key === "all"
                  ? openItems.length
                  : openItems.filter((i) => (i.urgency || "medium") === key).length
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickUrgency(key)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    urgency === key
                      ? "bg-surface text-ink shadow-(--shadow-card)"
                      : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {label}
                  <span className="text-ink-3 font-normal"> {n}</span>
                </button>
              )
            })}
          </div>
          <Button variant="ghost" className="!px-0" onClick={toggleGrouped}>
            {grouped ? "View ranked" : "Group by system"}
          </Button>
        </div>
      )}

      {openItems.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            Nothing open right now. {closedItems.length > 0 && "See resolved items below, or "}
            add an item to get started.
          </p>
        </Card>
      ) : (
        (() => {
          const priorityCard = (item, index) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {index !== null && (
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-ink-2 text-sm font-semibold shrink-0">
                      {index + 1}
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-ink">
                      {item.title}
                      {item.status === "scheduled" && (
                        <span className="ml-2 text-xs font-medium text-blue-700">
                          Scheduled
                        </span>
                      )}
                    </p>
                    {item.category ? (
                      <Link
                        to={`/health-report#trade-${tradeForItem(item).key}`}
                        className="text-sm text-ink-2 hover:text-brand-700"
                      >
                        {item.category}
                      </Link>
                    ) : null}
                    <p className="text-sm text-ink-2 mt-1.5">{item.reason}</p>
                    <div className="flex gap-3 mt-3 flex-wrap">
                      <Button variant="ghost" className="!px-0" onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                      {item.status !== "scheduled" && (
                        <Button
                          variant="ghost"
                          className="!px-0"
                          onClick={() => update(item.id, { status: "scheduled" })}
                        >
                          Mark scheduled
                        </Button>
                      )}
                      {founder &&
                        (item.workOrderId ? (
                          <Link
                            to="/work-orders"
                            className="text-sm font-medium text-brand-600 hover:text-brand-800 self-center"
                          >
                            Work order raised ›
                          </Link>
                        ) : (
                          <Button
                            variant="ghost"
                            className="!px-0"
                            onClick={() => raiseWorkOrder(item)}
                          >
                            Raise work order
                          </Button>
                        ))}
                      <Button
                        variant="ghost"
                        className="!px-0"
                        onClick={() => disposition(item, "resolved")}
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-0"
                        onClick={() => disposition(item, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                  <UrgencyBadge urgency={item.urgency} />
                  <p className="text-sm text-ink-2">{item.estCost}</p>
                  {index !== null && urgency === "all" && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveUp(items.indexOf(item))}
                      className="text-ink-3 hover:text-ink-2 disabled:opacity-30 text-xs px-1.5 py-0.5 border border-line rounded"
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      disabled={index === shownOpen.length - 1}
                      onClick={() => moveDown(items.indexOf(item))}
                      className="text-ink-3 hover:text-ink-2 disabled:opacity-30 text-xs px-1.5 py-0.5 border border-line rounded"
                    >
                      &darr;
                    </button>
                  </div>
                  )}
                </div>
              </div>
              <ResolutionSection item={item} update={update} />
            </Card>
          )
          if (shownOpen.length === 0) {
            return (
              <Card>
                <p className="text-sm text-ink-2">
                  No {urgency}-urgency items open right now.
                </p>
              </Card>
            )
          }
          return grouped ? (
            <div className="flex flex-col gap-5">
              {groupByTrade(shownOpen).map(({ trade, items: groupItems }) => (
                <div key={trade.key}>
                  <h2 className="text-sm font-semibold text-ink-2 mb-2">
                    {trade.label} ({groupItems.length})
                  </h2>
                  <div className="flex flex-col gap-3">
                    {groupItems.map((item) => priorityCard(item, null))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {shownOpen.map((item, index) => priorityCard(item, index))}
            </div>
          )
        })()
      )}

      {closedItems.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-ink-2 mb-2">
            Closed ({closedItems.length})
          </h2>
          <div className="flex flex-col gap-2">
            {closedItems.map((item) => (
              <div
                key={item.id}
                className="bg-surface border border-line rounded-lg px-4 py-3 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink-2 line-through decoration-ink-3/50">
                    {item.title}
                  </p>
                  <p className="text-xs text-ink-3">
                    {DISPOSITION_LABEL[item.status] || "Closed"}
                    {item.resolvedOn && ` · ${item.resolvedOn}`}
                    {item.resolutionNote && ` · ${item.resolutionNote}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="text-xs text-ink-3 hover:text-ink"
                    onClick={() => update(item.id, { status: "open", resolvedOn: "", resolutionNote: "" })}
                  >
                    Reopen
                  </button>
                  <button
                    type="button"
                    className="text-xs text-ink-3 hover:text-red-600"
                    onClick={() => setConfirmDelete(item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add item" : "Edit item"} onClose={() => setEditing(null)}>
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? {} : editing}
            onSubmit={(values) => {
              if (editing === "new") {
                add(values)
              } else {
                update(editing.id, values)
              }
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {resolving && (
        <Modal
          title={resolveMode === "resolved" ? "Resolve item" : "Dismiss item"}
          onClose={() => setResolving(null)}
        >
          <p className="text-sm text-ink-2 mb-3">"{resolving.title}"</p>
          <label className="flex flex-col gap-1 text-sm mb-4">
            <span className="font-medium text-ink-2">
              {resolveMode === "resolved" ? "What was done? (optional)" : "Why dismiss? (optional)"}
            </span>
            <textarea
              className="border border-line rounded-lg px-3 py-2 bg-surface text-ink"
              rows={2}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder={
                resolveMode === "resolved"
                  ? "e.g. Serviced by Monticello Air 7/3/26"
                  : "e.g. Not applicable to this property"
              }
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button onClick={confirmDisposition}>
              {resolveMode === "resolved" ? "Resolve" : "Dismiss"}
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete item?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Permanently remove "{confirmDelete.title}"? Resolving or dismissing
            keeps the record; delete removes it entirely.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                remove(confirmDelete.id)
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
