import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { subscribeContractors } from "../firestoreApi"
import { viewFor } from "../roles"
import VisitNoteCard from "../VisitNoteCard"
import { RecordTabs } from "../HubTabs"
import { groupByTrade, tradeForItem } from "../trades"
import { byDateDesc, byMonth, tradeJobRollup } from "../jobHistoryView"
import { Card, PageHeader, StatusBadge, Button, Modal, DynamicForm } from "../components"

const baseFields = [
  { name: "date", label: "Date", type: "text", placeholder: "e.g. June 24, 2026" },
  { name: "title", label: "Title", type: "text" },
  { name: "category", label: "Category", type: "text" },
  { name: "sub", label: "Contractor / sub", type: "text" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: ["completed", "scheduled"],
    optionLabels: { completed: "Completed", scheduled: "Scheduled" },
  },
  { name: "cost", label: "Cost", type: "text", placeholder: "e.g. $225" },
  { name: "notes", label: "Notes", type: "textarea" },
]

export default function JobHistory() {
  const { uid, user, profile } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "jobHistory")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [contractors, setContractors] = useState([])
  const founder = viewFor(user?.email).business
  const [grouped, setGrouped] = useState(() => {
    try {
      return localStorage.getItem("groupJobs") === "1"
    } catch {
      return false
    }
  })
  function toggleGrouped() {
    setGrouped((g) => {
      try {
        localStorage.setItem("groupJobs", g ? "" : "1")
      } catch {
        /* fine */
      }
      return !g
    })
  }

  // Founders get a picker into the shared contractor network, so new jobs
  // carry a real contractorId from creation instead of relying on the
  // Contractor Network page's retroactive name-matching. Non-founder
  // members never query the founder-only contractors collection at all.
  useEffect(() => {
    if (!founder) return
    return subscribeContractors(setContractors, () => {})
  }, [founder])

  const fields = founder
    ? [
        ...baseFields.slice(0, 3),
        {
          name: "contractorId",
          label: "Contractor (network)",
          type: "select",
          options: ["", ...contractors.map((c) => c.id)],
          optionLabels: {
            "": "— not in network / one-off —",
            ...Object.fromEntries(contractors.map((c) => [c.id, c.name])),
          },
        },
        ...baseFields.slice(3),
      ]
    : baseFields

  function submit(values) {
    const patch = { ...values }
    if (patch.contractorId) {
      const c = contractors.find((x) => x.id === patch.contractorId)
      if (c) patch.sub = c.name
    } else {
      delete patch.contractorId
    }
    if (editing === "new") {
      add(patch)
    } else {
      update(editing.id, patch)
    }
    setEditing(null)
  }

  return (
    <div>
      <RecordTabs />
      <PageHeader
        title="Job History"
        subtitle="A complete record of every job dispatched on your property."
        action={<Button onClick={() => setEditing("new")}>+ Add job</Button>}
      />

      {founder && <VisitNoteCard uid={uid} profile={profile} jobs={items} />}

      {items.length > 0 && (
        <div className="flex justify-end mb-2">
          <Button variant="ghost" className="!px-0" onClick={toggleGrouped}>
            {grouped ? "View timeline" : "Group by system"}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">No jobs logged yet.</p>
        </Card>
      ) : (
        (() => {
          const jobCard = (job) => (
            <Card key={job.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">{job.title}</p>
                  <p className="text-sm text-ink-2">
                    {job.date} ·{" "}
                    {job.category ? (
                      <Link
                        to={`/health-report#trade-${tradeForItem(job).key}`}
                        className="hover:text-brand-700"
                      >
                        {job.category}
                      </Link>
                    ) : (
                      "—"
                    )}{" "}
                    ·{" "}
                    {founder && job.contractorId ? (
                      <Link
                        to={`/contractor-network/${job.contractorId}`}
                        className="text-brand-600 hover:text-brand-800 underline"
                      >
                        {job.sub}
                      </Link>
                    ) : (
                      job.sub
                    )}
                  </p>
                  <p className="text-sm text-ink-2 mt-1.5">{job.notes}</p>
                  <div className="flex gap-3 mt-3">
                    <Button variant="ghost" className="!px-0" onClick={() => setEditing(job)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      className="!px-0"
                      onClick={() => setConfirmDelete(job)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={job.status} />
                  <p className="text-sm text-ink-2 mt-2">{job.cost}</p>
                </div>
              </div>
            </Card>
          )
          return grouped ? (
            <div className="flex flex-col gap-5">
              {groupByTrade(byDateDesc(items)).map(({ trade, items: groupItems }) => (
                <div key={trade.key}>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h2 className="text-sm font-semibold text-ink-2">
                      {trade.label} ({groupItems.length})
                    </h2>
                    <span className="text-xs text-ink-3">{tradeJobRollup(groupItems)}</span>
                  </div>
                  <div className="flex flex-col gap-3">{groupItems.map(jobCard)}</div>
                </div>
              ))}
            </div>
          ) : (
            // Timeline: newest activity first, bucketed by the month the work
            // actually happened (not when it was logged).
            <div className="flex flex-col gap-6">
              {byMonth(items).map(({ key, label, jobs }) => (
                <section key={key}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <h2 className="text-sm font-semibold text-ink-2">{label}</h2>
                    <span className="text-xs text-ink-3">
                      {jobs.length} job{jobs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 border-l-2 border-line pl-4">
                    {jobs.map(jobCard)}
                  </div>
                </section>
              ))}
            </div>
          )
        })()
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add job" : "Edit job"} onClose={() => setEditing(null)}>
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? { status: "scheduled" } : editing}
            onSubmit={submit}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete job?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{confirmDelete.title}" from your job history?
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
