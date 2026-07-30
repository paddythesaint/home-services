import { useState } from "react"
import { addMember, removeMember, saveProperty } from "./firestoreApi"
import { Card, Button } from "./components"

// Respect doctrine (7/30): business staff are never listed among a home's
// people — their access is platform-side (firestore.rules), invisible
// here. A member row stamped with a staff seat (a pre-doctrine artifact)
// stays hidden; genuine owners are always stored as "owner" or "diy",
// so a founder who owns their own home still appears — as its owner.
const BUSINESS_SEATS = new Set(["founder", "relationship", "technician"])

const displayRole = (m) => (m.role === "diy" ? "diy pilot" : m.role || "owner")

// People-with-access panel. Members are stored on the property doc; owners
// invite by email (no Firebase uid needed — the invitee signs in with that
// Google account and the resolver matches them by verified email).
//
// The invite captures two onboarding choices up front (7/28):
//   - Access level: homeowner (white-glove client) vs diy pilot
//     (self-builds and self-manages). The choice is stored on the member
//     record; pilot capabilities are activated platform-side.
//   - Weekly brief style: their consent + preference for the Monday email,
//     written to profile.briefStyles so the sender honors it from day one.
const BRIEF_CHOICES = [
  { value: "passive", label: "Weekly note — the light check-in" },
  { value: "proactive", label: "Weekly plan — full actions & decisions" },
]

export default function Members({ uid, profile, currentEmail }) {
  const members = (profile.members || []).filter((m) => !BUSINESS_SEATS.has(m.role))
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState("owner")
  const [briefStyle, setBriefStyle] = useState("passive")
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
      await addMember(uid, { email: clean, name, role })
      // Their weekly-brief election, acknowledged at onboarding.
      await saveProperty(uid, {
        briefStyles: { ...(profile.briefStyles || {}), [clean]: briefStyle },
      })
      setEmail("")
      setName("")
      setRole("owner")
      setBriefStyle("passive")
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
        Everyone listed can view and edit this home's record. Invite by the
        Google email they'll sign in with.
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
                <span className="text-xs text-ink-3 capitalize">
                  {displayRole(m)}
                  {profile.briefStyles?.[m.email] && (
                    <span className="text-ink-3"> · {profile.briefStyles[m.email]} brief</span>
                  )}
                </span>
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
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex-1 text-xs text-ink-3">
            Access level
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full border border-line rounded-lg px-2 py-2 bg-surface text-ink text-sm"
            >
              <option value="owner">Homeowner — we manage the home</option>
              <option value="diy">DIY pilot — self-builds & self-manages</option>
            </select>
          </label>
          <label className="flex-1 text-xs text-ink-3">
            Weekly brief
            <select
              value={briefStyle}
              onChange={(e) => setBriefStyle(e.target.value)}
              className="mt-1 w-full border border-line rounded-lg px-2 py-2 bg-surface text-ink text-sm"
            >
              {BRIEF_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Invite"}
            </Button>
          </div>
        </div>
        {role === "diy" && (
          <p className="text-xs text-ink-3">
            Pilot tools (walkthrough, projects board) are switched on platform-side
            after the invite — usually the same day.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </Card>
  )
}
