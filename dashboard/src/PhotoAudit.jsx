// Founder data-integrity tool, born from a real incident: generator photos
// were imported correctly but invisible behind a collapsed toggle, and the
// owner couldn't tell whether they were lost, misfiled, or orphaned. This
// answers that in one click: every photo on the property, counted per
// system, with orphans (photos whose system no longer exists) surfaced
// and reattachable. Running it also backfills each system's photoCount.

import { useState } from "react"
import { fetchAllPhotos, updatePhoto, removePhoto, setPhotoCount } from "./firestoreApi"
import { Card, Button } from "./components"

export default function PhotoAudit({ uid, systems }) {
  const [state, setState] = useState({ status: "idle", photos: [] })
  const [attachTargets, setAttachTargets] = useState({}) // photoId -> systemId

  async function run() {
    setState({ status: "running", photos: [] })
    try {
      const photos = await fetchAllPhotos(uid)
      // Backfill denormalized counts while we have the truth in hand.
      const counts = new Map()
      for (const p of photos) counts.set(p.systemId, (counts.get(p.systemId) || 0) + 1)
      for (const s of systems) {
        const real = counts.get(s.id) || 0
        if ((s.photoCount || 0) !== real) await setPhotoCount(uid, s.id, real)
      }
      setState({ status: "done", photos })
    } catch (err) {
      setState({ status: "error", photos: [], error: err.message || String(err) })
    }
  }

  async function reattach(photo) {
    const target = attachTargets[photo.id]
    if (!target) return
    await updatePhoto(uid, photo.id, { systemId: target })
    await setPhotoCount(
      uid,
      target,
      state.photos.filter((p) => p.systemId === target).length + 1
    )
    setState((s) => ({
      ...s,
      photos: s.photos.map((p) => (p.id === photo.id ? { ...p, systemId: target } : p)),
    }))
  }

  const systemIds = new Set(systems.map((s) => s.id))
  const counts = new Map()
  for (const p of state.photos) counts.set(p.systemId, (counts.get(p.systemId) || 0) + 1)
  const orphans = state.photos.filter((p) => !systemIds.has(p.systemId))

  return (
    <Card title="Photo audit">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-ink-2">
          Counts every photo on this property by system, surfaces any filed under a
          system that no longer exists, and refreshes the "Photos (N)" counts above.
        </p>
        <Button variant="subtle" onClick={run} disabled={state.status === "running"}>
          {state.status === "running" ? "Auditing…" : state.status === "done" ? "Re-run audit" : "Audit photos"}
        </Button>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600 mt-3">Audit failed: {state.error}</p>
      )}

      {state.status === "done" && (
        <>
          <p className="text-sm font-medium text-ink mt-3">
            {state.photos.length} photo{state.photos.length === 1 ? "" : "s"} on the
            property{orphans.length > 0 && ` — ${orphans.length} orphaned`}.
          </p>
          <ul className="mt-2 divide-y divide-line">
            {systems.map((s) => (
              <li key={s.id} className="py-1.5 flex items-center justify-between text-sm">
                <span className="text-ink">{s.category}</span>
                <span className={counts.get(s.id) ? "text-ink-2" : "text-ink-3"}>
                  {counts.get(s.id) || 0} photo{(counts.get(s.id) || 0) === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>

          {orphans.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line">
              <p className="text-sm font-medium text-ink mb-2">
                Orphaned photos — attach each to the right system:
              </p>
              <ul className="flex flex-col gap-2">
                {orphans.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <img
                      src={p.dataUrl}
                      alt="Orphaned"
                      className="w-14 h-14 object-cover rounded-md border border-line shrink-0"
                    />
                    <span className="text-xs text-ink-3">{p.takenOn}</span>
                    <select
                      className="border border-line rounded-md px-2 py-1 text-xs bg-surface text-ink"
                      value={attachTargets[p.id] || ""}
                      onChange={(e) =>
                        setAttachTargets((t) => ({ ...t, [p.id]: e.target.value }))
                      }
                    >
                      <option value="">— choose system —</option>
                      {systems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.category}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="subtle"
                      disabled={!attachTargets[p.id]}
                      onClick={() => reattach(p)}
                    >
                      Attach
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-ink-3 hover:text-red-600"
                      onClick={async () => {
                        await removePhoto(uid, p.id, p.systemId)
                        setState((s) => ({
                          ...s,
                          photos: s.photos.filter((x) => x.id !== p.id),
                        }))
                      }}
                    >
                      delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
