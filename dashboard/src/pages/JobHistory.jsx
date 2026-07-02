import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { Card, PageHeader, StatusBadge, Button, Modal, DynamicForm } from "../components"

const fields = [
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
  const { uid } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "jobHistory")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const orderedItems = [...items].reverse()

  return (
    <div>
      <PageHeader
        title="Job History"
        subtitle="A complete record of every job dispatched on your property."
        action={<Button onClick={() => setEditing("new")}>+ Add job</Button>}
      />

      {orderedItems.length === 0 ? (
        <Card>
          <p className="text-sm text-brand-600">No jobs logged yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orderedItems.map((job) => (
            <Card key={job.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-brand-900">{job.title}</p>
                  <p className="text-sm text-brand-600">
                    {job.date} · {job.category} · {job.sub}
                  </p>
                  <p className="text-sm text-brand-700 mt-1.5">{job.notes}</p>
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
                  <p className="text-sm text-brand-600 mt-2">{job.cost}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add job" : "Edit job"} onClose={() => setEditing(null)}>
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? { status: "scheduled" } : editing}
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

      {confirmDelete && (
        <Modal title="Delete job?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-brand-700 mb-4">
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
