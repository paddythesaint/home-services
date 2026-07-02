import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { Card, PageHeader, Button, Modal, DynamicForm } from "../components"

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

  return (
    <div>
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
                <p className="font-semibold text-brand-900">{month}</p>
                {month === CURRENT_MONTH && (
                  <span className="text-xs font-medium text-brand-600">This month</span>
                )}
              </div>
              {monthItems.length === 0 ? (
                <p className="text-sm text-brand-400">No tasks yet</p>
              ) : (
                <ul className="text-sm text-brand-700 space-y-1.5">
                  {monthItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2">
                      <span>&bull; {item.task}</span>
                      <span className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className="text-brand-500 hover:text-brand-800 text-xs"
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

      {confirmDelete && (
        <Modal title="Delete task?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-brand-700 mb-4">
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
