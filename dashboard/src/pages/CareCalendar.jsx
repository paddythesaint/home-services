import { useState } from "react"
import { PlanTabs } from "../HubTabs"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { addItem } from "../firestoreApi"
import { todayLabel } from "../dates"
import { tradeForItem } from "../trades"
import { Card, PageHeader, Button, Modal, DynamicForm } from "../components"

const THIS_YEAR = new Date().getFullYear()
export const isDoneThisYear = (item) => item.doneYear === THIS_YEAR

const jobFields = [
  { name: "date", label: "When was it done?", type: "text" },
  { name: "sub", label: "Who did it?", type: "text", placeholder: "e.g. Owner (DIY) or company name" },
  { name: "cost", label: "Cost", type: "text", placeholder: "optional" },
]

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const CURRENT_MONTH = MONTHS[new Date().getMonth()]

const fields = [
  { name: "month", label: "Month", type: "select", options: MONTHS },
  { name: "task", label: "Task", type: "text", placeholder: "e.g. Irrigation startup" },
]

export default function CareCalendar() {
  const { uid } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "careCalendar")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loggingJob, setLoggingJob] = useState(null) // task just marked done

  // Done is per-year: the stamp names this year, so every January the
  // schedule resets itself without anyone touching it.
  async function markDone(item) {
    await update(item.id, { doneOn: todayLabel(), doneYear: THIS_YEAR })
    setLoggingJob(item)
  }

  return (
    <div>
      <PlanTabs />
      <PageHeader
        title="Annual Care Calendar"
        subtitle="Your seasonal maintenance schedule — add tasks month by month."
        action={<Button onClick={() => setEditing("new")}>+ Add task</Button>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MONTHS.map((month) => {
          const monthItems = items.filter((i) => i.month === month)
          return (
            <Card
              key={month}
              className={month === CURRENT_MONTH ? "border-brand-400 ring-1 ring-brand-400" : ""}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-ink">{month}</p>
                {month === CURRENT_MONTH && (
                  <span className="text-xs font-medium text-ink-2">This month</span>
                )}
              </div>
              {monthItems.length === 0 ? (
                <p className="text-sm text-ink-3">No tasks yet</p>
              ) : (
                <ul className="text-sm text-ink-2 space-y-1.5">
                  {monthItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2">
                      <span className={isDoneThisYear(item) ? "text-ink-3" : ""}>
                        {isDoneThisYear(item) ? (
                          <span className="text-status-good font-medium" aria-hidden="true">
                            ✓{" "}
                          </span>
                        ) : (
                          <>&bull; </>
                        )}
                        <Link
                          to={`/health-report#trade-${tradeForItem(item).key}`}
                          className="hover:text-brand-700"
                        >
                          {item.task}
                        </Link>
                        {isDoneThisYear(item) && (
                          <span className="text-xs text-ink-3"> · done {item.doneOn}</span>
                        )}
                      </span>
                      <span className="flex gap-2 shrink-0">
                        {!isDoneThisYear(item) && (
                          <button
                            type="button"
                            className="text-brand-600 hover:text-brand-800 text-xs font-medium"
                            onClick={() => markDone(item)}
                          >
                            mark done
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-ink-3 hover:text-ink-2 text-xs"
                          onClick={() => setEditing(item)}
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-800 text-xs"
                          onClick={() => setConfirmDelete(item)}
                        >
                          delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Add task" : "Edit task"} onClose={() => setEditing(null)}>
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? { month: CURRENT_MONTH } : editing}
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

      {loggingJob && (
        <Modal
          title={`Done — log "${loggingJob.task}" as a job?`}
          onClose={() => setLoggingJob(null)}
        >
          <p className="text-sm text-ink-2 mb-4">
            The task is checked off for {THIS_YEAR}. Logging it as a job keeps the
            history complete — who did it, when, and what it cost.
          </p>
          <DynamicForm
            fields={jobFields}
            initialValues={{ date: todayLabel(), sub: "Owner (DIY)" }}
            submitLabel="Log job"
            onSubmit={async (v) => {
              await addItem(uid, "jobHistory", {
                date: v.date || todayLabel(),
                title: loggingJob.task,
                category: tradeForItem(loggingJob).label,
                sub: v.sub || "",
                cost: v.cost || "",
                status: "completed",
                notes: "Care calendar task.",
              })
              setLoggingJob(null)
            }}
          />
          <div className="flex justify-end mt-2">
            <Button variant="ghost" onClick={() => setLoggingJob(null)}>
              Skip — just check it off
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete task?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{confirmDelete.task}" from {confirmDelete.month}?
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
