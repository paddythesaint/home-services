import { useEffect, useState } from "react"
import {
  subscribeClientCard,
  saveClientCard,
  addTouch,
  subscribeTouches,
} from "./firestoreApi"
import { todayLabel } from "./dates"
import { Card, Button } from "./components"

const TOUCH_TYPES = ["call", "text", "email", "visit"]
const CARD_FIELDS = [
  { name: "preferences", label: "Preferences", hint: "Visit times, communication style…" },
  { name: "access", label: "Access & household", hint: "Gate codes, pets, alarm quirks…" },
  { name: "keyDates", label: "Key dates", hint: "Travel, anniversaries, seasonal rhythms…" },
]

// What the business remembers about the relationship. Founder-only —
// stored in clients/{propertyId}, which members cannot read (see
// firestore.rules). White-glove is remembering things; this is where
// remembered things live.
export default function RelationshipCard({ uid }) {
  const [card, setCard] = useState(null)
  const [touches, setTouches] = useState([])
  const [draft, setDraft] = useState(null) // field values while editing
  const [touchType, setTouchType] = useState("call")
  const [touchNote, setTouchNote] = useState("")
  const [denied, setDenied] = useState(false)

  useEffect(() => subscribeClientCard(uid, setCard, () => setDenied(true)), [uid])
  useEffect(() => subscribeTouches(uid, setTouches, () => {}), [uid])

  async function logTouch() {
    if (!touchNote.trim()) return
    await addTouch(uid, { date: todayLabel(), type: touchType, note: touchNote.trim() })
    setTouchNote("")
  }

  if (denied) {
    return (
      <Card title="Client relationship (private to HPS)" className="mt-4">
        <p className="text-sm text-status-critical">
          The clients store isn't readable — publish dashboard/firestore.rules (see System
          status on the Command Center).
        </p>
      </Card>
    )
  }
  if (card === null) return null

  return (
    <Card title="Client relationship (private to HPS)" className="mt-4">
      <p className="text-xs text-ink-3 -mt-1 mb-3">
        Members never see this card — it's the business's memory of the household.
      </p>

      {draft ? (
        <div className="flex flex-col gap-3">
          {CARD_FIELDS.map((f) => (
            <label key={f.name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink-2">{f.label}</span>
              <textarea
                rows={2}
                value={draft[f.name] || ""}
                placeholder={f.hint}
                onChange={(e) => setDraft((d) => ({ ...d, [f.name]: e.target.value }))}
                className="border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
              />
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await saveClientCard(uid, draft)
                setDraft(null)
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CARD_FIELDS.map((f) => (
            <div key={f.name}>
              <p className="text-xs font-semibold text-ink-3">{f.label}</p>
              <p className="text-sm text-ink-2 mt-0.5 whitespace-pre-line">
                {card[f.name] || <span className="text-ink-3">—</span>}
              </p>
            </div>
          ))}
          <div className="md:col-span-3">
            <Button variant="ghost" className="!px-0" onClick={() => setDraft({ ...card })}>
              Edit
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-xs font-semibold text-ink-3 mb-2">
          Touch log{touches.length > 0 && ` · last: ${touches[0].date}`}
        </p>
        <div className="flex items-center gap-2 mb-3">
          <select
            value={touchType}
            onChange={(e) => setTouchType(e.target.value)}
            className="border border-line rounded-lg px-2 py-1.5 bg-surface text-ink text-xs"
            aria-label="Touch type"
          >
            {TOUCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={touchNote}
            onChange={(e) => setTouchNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && logTouch()}
            placeholder="One line on the conversation…"
            className="flex-1 border border-line rounded-lg px-2.5 py-1.5 bg-surface text-ink text-xs focus:outline-none focus:border-brand-400"
          />
          <Button variant="subtle" onClick={logTouch} disabled={!touchNote.trim()}>
            Log
          </Button>
        </div>
        {touches.length === 0 ? (
          <p className="text-xs text-ink-3">No touches logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {touches.slice(0, 6).map((t) => (
              <li key={t.id} className="py-1.5 text-xs text-ink-2">
                <span className="font-medium text-ink">{t.date}</span>
                <span className="text-ink-3"> · {t.type} · </span>
                {t.note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
