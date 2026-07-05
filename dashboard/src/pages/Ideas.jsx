import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { subscribeIdeas, addIdea, updateIdea, removeIdea } from "../firestoreApi"
import { viewFor } from "../roles"
import { todayLabel } from "../dates"
import { Card, PageHeader, Button, Modal } from "../components"

// The founders' shared scratchpad: things worth building, offering, or
// trying — captured the moment they occur, visible to both owners, never
// to anyone else. Deliberately lighter than a project tracker: title,
// a note, who had it, open or done.
export default function Ideas() {
  const { user } = useOutletContext()
  const founder = viewFor(user?.email).business

  const [state, setState] = useState({ status: "loading", ideas: [] })
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    if (!founder) return
    return subscribeIdeas(
      (list) => setState({ status: "ready", ideas: list }),
      () => setState({ status: "denied", ideas: [] })
    )
  }, [founder])

  if (!founder) {
    return (
      <div>
        <PageHeader title="Ideas" subtitle="Business owners only." />
        <Card>
          <p className="text-sm text-ink-2">
            This is the owners' shared idea board.{" "}
            <Link to="/" className="underline">
              Back to the homeowner view
            </Link>
            .
          </p>
        </Card>
      </div>
    )
  }

  async function add() {
    const t = title.trim()
    if (!t) return
    await addIdea({
      title: t,
      notes: notes.trim(),
      addedBy: user?.displayName || (user?.email || "").split("@")[0],
      createdOn: todayLabel(),
      status: "open",
    })
    setTitle("")
    setNotes("")
  }

  const open = state.ideas.filter((i) => i.status !== "done")
  const done = state.ideas.filter((i) => i.status === "done")

  return (
    <div>
      <PageHeader
        title="Ideas"
        subtitle="The owners' shared board — capture it now, shape it later. Only the two of you see this."
      />

      {state.status === "denied" && (
        <Card className="mb-4">
          <p className="text-sm text-status-critical">
            The ideas store isn't readable — publish dashboard/firestore.rules (see System
            status on the Command Center).
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What's the idea?"
            className="border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
          />
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="A line of context (optional)"
            className="border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
          />
          <div className="flex justify-end">
            <Button onClick={add} disabled={!title.trim()}>
              Add idea
            </Button>
          </div>
        </div>
      </Card>

      {state.status === "ready" && open.length === 0 && done.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            Nothing here yet — the best ones show up in the shower. Write them down fast.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {open.map((idea) => (
            <Card key={idea.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{idea.title}</p>
                  {idea.notes && <p className="text-sm text-ink-2 mt-1">{idea.notes}</p>}
                  <p className="text-xs text-ink-3 mt-1.5">
                    {idea.addedBy}
                    {idea.createdOn && ` · ${idea.createdOn}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="subtle"
                    onClick={() => updateIdea(idea.id, { status: "done" })}
                  >
                    Done
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing({ ...idea })}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmDelete(idea)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {done.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs font-medium text-ink-3 hover:text-ink"
                onClick={() => setShowDone((s) => !s)}
              >
                {showDone ? "Hide" : "Show"} done ({done.length})
              </button>
              {showDone && (
                <div className="mt-2 flex flex-col gap-2">
                  {done.map((idea) => (
                    <div
                      key={idea.id}
                      className="bg-surface border border-line rounded-xl px-4 py-3 flex items-start justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink-2 line-through decoration-ink-3/50">
                          {idea.title}
                        </p>
                        <p className="text-xs text-ink-3">
                          {idea.addedBy}
                          {idea.createdOn && ` · ${idea.createdOn}`}
                        </p>
                      </div>
                      <div className="flex gap-3 shrink-0 text-xs">
                        <button
                          type="button"
                          className="text-ink-3 hover:text-ink"
                          onClick={() => updateIdea(idea.id, { status: "open" })}
                        >
                          Reopen
                        </button>
                        <button
                          type="button"
                          className="text-ink-3 hover:text-red-600"
                          onClick={() => setConfirmDelete(idea)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal title="Edit idea" onClose={() => setEditing(null)}>
          <div className="flex flex-col gap-3">
            <input
              value={editing.title}
              onChange={(e) => setEditing((d) => ({ ...d, title: e.target.value }))}
              className="border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400"
              aria-label="Idea title"
            />
            <textarea
              rows={3}
              value={editing.notes || ""}
              onChange={(e) => setEditing((d) => ({ ...d, notes: e.target.value }))}
              className="border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400"
              aria-label="Idea notes"
            />
            <div className="flex justify-end gap-2">
              <Button variant="subtle" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  await updateIdea(editing.id, {
                    title: editing.title.trim(),
                    notes: (editing.notes || "").trim(),
                  })
                  setEditing(null)
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete idea?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">Remove "{confirmDelete.title}" for good?</p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                removeIdea(confirmDelete.id)
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
