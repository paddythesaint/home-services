import { useState } from "react"
import { addMember, removeMember } from "./firestoreApi"
import { Card, Button } from "./components"

// People-with-access panel. Members are stored on the property doc; owners
// invite by email (no Firebase uid needed — the invitee signs in with that
// Google account and the resolver matches them by verified email).
export default function Members({ uid, profile, currentEmail }) {
  const members = profile.members || []
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function invite(e) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!clean.includes("@")) {
      setError("Enter a valid email address")
      return
    }
    setBusy(true)
    setError("")
    try {
      await addMember(uid, { email: clean, name, role: "owner" })
      setEmail("")
      setName("")
    } catch (err) {
      console.error(err)
      setError("Couldn't add — try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="People with access">
      <p className="text-sm text-ink-2 mb-3">
        Everyone listed is a full owner — they can view and edit everything.
        Invite by the Google email they'll sign in with.
      </p>

      <ul className="divide-y divide-line mb-4">
        {members.length === 0 ? (
          <li className="py-2 text-sm text-ink-3">
            Just you so far.
          </li>
        ) : (
          members.map((m) => (
            <li key={m.email} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {m.name || m.email}
                  {m.email === currentEmail && (
                    <span className="ml-2 text-xs font-normal text-ink-3">(you)</span>
                  )}
                </p>
                {m.name && <p className="text-xs text-ink-3 truncate">{m.email}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-ink-3 capitalize">{m.role || "owner"}</span>
                {m.email !== currentEmail && (
                  <button
                    type="button"
                    onClick={() => removeMember(uid, m.email)}
                    className="text-xs text-ink-3 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      <form className="flex flex-col gap-2" onSubmit={invite}>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
            className="flex-1 border border-line rounded-lg px-3 py-2 bg-surface text-ink text-sm"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="flex-1 border border-line rounded-lg px-3 py-2 bg-surface text-ink text-sm"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Invite"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </Card>
  )
}
