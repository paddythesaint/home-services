import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "./useItems"
import { addItem } from "./firestoreApi"
import { todayLabel } from "./dates"
import { isUnderway, isOpenWorkOrder } from "./workOrders"
import { seedAddressHint } from "./seedData"
import { TEAM } from "./team"
import hero895 from "./assets/hero-895.jpg"
import { Card, Button, Modal } from "./components"

// The homeowner's home screen — the calm answer to three questions:
// is my home okay, what's happening, and how do I reach you. None of the
// operational machinery (insight banners, verification states, stat
// grids) renders here; that's ours, not theirs.

// A homeowner's own request is visible from the moment they send it —
// nothing they ask for ever disappears into a void.
const visibleToHomeowner = (w) =>
  isUnderway(w) || (w.source === "homeowner" && isOpenWorkOrder(w))

function happeningLabel(w) {
  if (w.lane === "in-progress") return "being worked on"
  if (w.lane === "scheduled")
    return w.scheduledFor ? `scheduled for ${w.scheduledFor}` : "on the calendar"
  return "received — we're arranging it"
}

function statusLine(systems) {
  if (systems.length === 0) return "We're building your home's record."
  const urgent = systems.filter((s) => s.condition === "urgent").length
  const attention = systems.filter((s) => s.condition === "attention").length
  if (urgent > 0)
    return `We're on it — ${urgent} item${urgent === 1 ? "" : "s"} being handled with priority.`
  if (attention > 0)
    return `Healthy overall — ${attention} item${attention === 1 ? "" : "s"} on our watch list.`
  return "Your home is in good shape."
}

export default function HomeownerHome() {
  const { uid, profile, user } = useOutletContext()
  const { items: systems } = useItems(uid, "healthReport")
  const { items: workOrders } = useItems(uid, "workOrders")
  const { items: jobs } = useItems(uid, "jobHistory")
  const { items: visitNotes } = useItems(uid, "visitNotes")
  const latestNote = visitNotes[visitNotes.length - 1]

  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  const happening = workOrders.filter(visibleToHomeowner)
  const recentCare = jobs
    .filter((j) => j.status === "completed")
    .slice(-3)
    .reverse()
  const isSeedProperty = seedAddressHint.test(profile.address || "")

  async function sendRequest() {
    const text = message.trim()
    if (!text) return
    await addItem(uid, "workOrders", {
      title: text.split("\n")[0].slice(0, 70),
      notes: text,
      category: "",
      lane: "triage",
      source: "homeowner",
      requestedBy: user?.email || "",
      assigneeType: "",
      contractorId: "",
      contractorName: "",
      quoteStatus: "none",
      quoteAmount: "",
      scheduledFor: "",
      createdOn: todayLabel(),
    })
    setMessage("")
    setRequesting(false)
    setSent(true)
  }

  return (
    <div>
      {isSeedProperty ? (
        <div className="relative rounded-2xl overflow-hidden mb-6 shadow-(--shadow-card)">
          <img src={hero895} alt={profile.address} className="w-full h-52 md:h-72 object-cover" />
          <div
            className="absolute inset-0 bg-gradient-to-t from-brand-950/75 via-brand-950/15 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <h1 className="font-display text-2xl md:text-4xl font-semibold text-white leading-tight">
              {profile.address}
            </h1>
            <p className="text-sm text-white/85 mt-1.5">{statusLine(systems)}</p>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <h1 className="font-display text-2xl md:text-[32px] font-semibold text-ink leading-tight">
            {profile.address}
          </h1>
          <p className="text-sm text-ink-2 mt-1.5">{statusLine(systems)}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Need anything?</h2>
                <p className="text-sm text-ink-2 mt-1">
                  A repair, a question, something that doesn't look right — send it over and
                  we'll take it from there.
                </p>
                {sent && (
                  <p className="text-sm font-medium text-brand-700 mt-2">
                    Received — we'll be in touch shortly. You'll see it under "Happening now"
                    while we arrange it.
                  </p>
                )}
              </div>
              <Button onClick={() => setRequesting(true)} className="shrink-0">
                Request service
              </Button>
            </div>
          </Card>

          {latestNote && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-2">
                A note from your team{latestNote.sentOn ? ` · ${latestNote.sentOn}` : ""}
              </p>
              <p className="text-sm text-ink-2 whitespace-pre-line">{latestNote.body}</p>
            </Card>
          )}

          {happening.length > 0 && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-2">
                Happening now
              </p>
              <ul className="flex flex-col gap-1.5">
                {happening.map((w) => (
                  <li key={w.id} className="text-sm text-ink-2">
                    <span className="font-medium text-ink">{w.title}</span> — {happeningLabel(w)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {recentCare.length > 0 && (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-2">
                Recent care
              </p>
              <ul className="divide-y divide-line">
                {recentCare.map((j) => (
                  <li key={j.id} className="py-2 text-sm text-ink-2 flex justify-between gap-3">
                    <span>
                      <span className="font-medium text-ink">{j.title}</span>
                      {j.date && <span className="text-ink-3"> · {j.date}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card title="Your team">
          <ul className="flex flex-col gap-3">
            {TEAM.map((t) => (
              <li key={t.name}>
                <p className="text-sm font-semibold text-ink">{t.name}</p>
                <p className="text-xs text-ink-3">{t.title}</p>
                <p className="text-xs mt-0.5">
                  {t.email && (
                    <a
                      href={`mailto:${t.email}`}
                      className="text-brand-600 hover:text-brand-800 underline"
                    >
                      {t.email}
                    </a>
                  )}
                  {t.email && t.phone && " · "}
                  {t.phone && (
                    <a href={`tel:${t.phone}`} className="text-brand-600 hover:text-brand-800">
                      {t.phone}
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-3 mt-3 pt-3 border-t border-line">
            Anything urgent, call or text — the button here works too, and we see it right
            away.
          </p>
        </Card>
      </div>

      {requesting && (
        <Modal title="What can we take care of?" onClose={() => setRequesting(false)}>
          <textarea
            autoFocus
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. The kitchen disposal is jammed — hums but won't spin."
            className="w-full border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="subtle" onClick={() => setRequesting(false)}>
              Cancel
            </Button>
            <Button onClick={sendRequest} disabled={!message.trim()}>
              Send request
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
