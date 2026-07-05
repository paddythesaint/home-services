import { useState } from "react"
import { useItems } from "./useItems"
import { todayLabel } from "./dates"
import { composeVisitNote } from "./visitNotes"
import { businessRole } from "./roles"
import { Card, Button, Modal } from "./components"

// Founder tool on Job History: compose a client-ready visit note from the
// record, tweak it, send it (email/copy), and save it — the latest saved
// note greets the homeowner on their calm home screen.
export default function VisitNoteCard({ uid, profile, jobs }) {
  const { items: workOrders } = useItems(uid, "workOrders")
  const noteApi = useItems(uid, "visitNotes")
  const [draft, setDraft] = useState(null) // string while composing
  const [saved, setSaved] = useState(false)

  const recipients = (profile.memberEmails || []).filter((e) => !businessRole(e))
  const latest = noteApi.items[noteApi.items.length - 1]

  async function save() {
    await noteApi.add({ body: draft, sentOn: todayLabel() })
    setDraft(null)
    setSaved(true)
  }

  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink tracking-tight">Visit note</h2>
          <p className="text-sm text-ink-2 mt-1">
            Turn the recent record into a note the client actually reads — saved notes greet
            them on their dashboard.
          </p>
          {latest && (
            <p className="text-xs text-ink-3 mt-1">Last note: {latest.sentOn}</p>
          )}
          {saved && (
            <p className="text-sm font-medium text-brand-700 mt-1">
              Saved — it's on their dashboard now.
            </p>
          )}
        </div>
        <Button
          variant="subtle"
          className="shrink-0"
          onClick={() => {
            setSaved(false)
            setDraft(composeVisitNote({ profile, jobs, workOrders }))
          }}
        >
          Compose visit note
        </Button>
      </div>

      {draft !== null && (
        <Modal title="Visit note" onClose={() => setDraft(null)}>
          <textarea
            rows={14}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm font-mono focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
          />
          <div className="flex flex-wrap justify-end items-center gap-2 mt-4">
            {recipients.length > 0 && (
              <a
                className="text-sm font-medium text-brand-600 hover:text-brand-800 underline mr-auto"
                href={`mailto:${recipients.join(",")}?subject=${encodeURIComponent(
                  `Your home this week — ${profile.address || ""}`
                )}&body=${encodeURIComponent(draft)}`}
              >
                Open in email
              </a>
            )}
            <Button
              variant="subtle"
              onClick={() => navigator.clipboard?.writeText(draft).catch(() => {})}
            >
              Copy text
            </Button>
            <Button onClick={save}>Save note</Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}
