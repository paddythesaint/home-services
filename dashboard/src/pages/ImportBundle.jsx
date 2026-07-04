import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { addItem, addPhoto } from "../firestoreApi"
import { todayLabel } from "../dates"
import { logFact, fieldLabel } from "../facts"
import { Card, PageHeader, Button } from "../components"

// Loads a locally-provided JSON bundle (photos as data URLs + extracted facts
// + system mappings) and writes it to the property record as the signed-in
// owner. This is how bulk photo/document reviews done outside the app get in
// without the photos ever passing through the public repo: the bundle file
// stays on the user's device and goes straight to Firestore.
//
// Bundle shape (version 1):
// {
//   version: 1, source: "…",
//   systems: [{
//     match: ["lowercase substrings tried against category+detail"],
//     create: { category, detail, condition, note, … },   // used if no match
//     fill: { brand, installYear, location },             // fill-if-empty
//     noteAppend: "…",                       // logged to the fact feed, not appended to note
//     verify: true,                                       // mark verified
//     activity: [{ type, summary, value?, unit? }],
//     photos: [{ name, dataUrl }],
//   }],
//   priorities: [{ title, category, reason, urgency, estCost }],
// }

const isOpen = (p) => !p.status || p.status === "open" || p.status === "scheduled"

function findSystem(systems, matches) {
  for (const m of matches) {
    const hit = systems.find((s) =>
      `${s.category} ${s.detail}`.toLowerCase().includes(m.toLowerCase())
    )
    if (hit) return hit
  }
  return null
}

export default function ImportBundle() {
  const { uid } = useOutletContext()
  const healthApi = useItems(uid, "healthReport")
  const priorityApi = useItems(uid, "priorityList")
  const [bundle, setBundle] = useState(null)
  const [error, setError] = useState("")
  const [state, setState] = useState("idle") // idle | applying | done
  const [progress, setProgress] = useState("")
  const [log, setLog] = useState([])

  function loadFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError("")
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (data.version !== 1 || !Array.isArray(data.systems)) {
          throw new Error("Not a recognized bundle file")
        }
        setBundle(data)
        setState("idle")
        setLog([])
      } catch (err) {
        setError(`Couldn't read that file: ${err.message}`)
      }
    }
    reader.onerror = () => setError("Couldn't read that file.")
    reader.readAsText(file)
  }

  async function apply() {
    setState("applying")
    const done = []
    try {
      for (const entry of bundle.systems) {
        const label = entry.create?.category || entry.match?.[0] || "system"
        setProgress(`Applying ${label}…`)
        let target = findSystem(healthApi.items, entry.match || [])
        let targetId = target?.id
        if (!target) {
          const ref = await addItem(uid, "healthReport", {
            condition: "good",
            note: "",
            ...entry.create,
          })
          targetId = ref.id
        } else {
          const patch = {}
          for (const [k, v] of Object.entries(entry.fill || {})) {
            if (!target[k]) patch[k] = v
          }
          if (entry.verify) {
            patch.verified = true
            patch.verifiedOn = todayLabel()
          }
          if (Object.keys(patch).length > 0) {
            await healthApi.update(targetId, patch)
          }
          // What this wave asserted goes to the fact log, not appended into
          // note — note stays "current state, one paragraph" (BACKLOG.md);
          // the append-only activity feed is where history accumulates.
          const filledKeys = Object.keys(patch).filter((k) => k !== "verified" && k !== "verifiedOn")
          const parts = []
          if (filledKeys.length > 0) parts.push(`Set ${filledKeys.map(fieldLabel).join(", ")}`)
          if (patch.verified) parts.push("Verified")
          if (entry.noteAppend) parts.push(entry.noteAppend)
          if (parts.length > 0) {
            await logFact(uid, targetId, parts.join(" — "), {
              type: "import",
              label: bundle.source || "Imported bundle",
            }, bundle.takenOn)
          }
        }
        for (const act of entry.activity || []) {
          await addItem(uid, "activity", {
            systemId: targetId,
            type: act.type || "observation",
            summary: act.summary,
            ...(act.value ? { value: act.value } : {}),
            ...(act.unit ? { unit: act.unit } : {}),
            date: todayLabel(),
            order: Date.now(),
          })
        }
        let n = 0
        for (const photo of entry.photos || []) {
          n += 1
          setProgress(`Applying ${label}: photo ${n}/${entry.photos.length}…`)
          await addPhoto(uid, {
            systemId: targetId,
            dataUrl: photo.dataUrl,
            takenOn: bundle.takenOn || todayLabel(),
            order: Date.now() + n,
          })
        }
        done.push(
          `${target ? "Updated" : "Added"} ${label} (${entry.photos?.length || 0} photo${
            (entry.photos?.length || 0) === 1 ? "" : "s"
          })`
        )
        setLog([...done])
      }

      for (const p of bundle.priorities || []) {
        const dup = priorityApi.items.find(
          (x) => isOpen(x) && x.title.toLowerCase() === p.title.toLowerCase()
        )
        if (!dup) {
          await priorityApi.add({ category: "", reason: "", estCost: "", ...p })
          done.push(`Added priority: ${p.title}`)
          setLog([...done])
        }
      }
      setState("done")
    } catch (err) {
      console.error(err)
      setError(`Import stopped partway: ${err.message}. Already-applied items were saved — you can re-run; existing photos may duplicate but facts won't.`)
      setState("idle")
    }
  }

  const totalPhotos = bundle
    ? bundle.systems.reduce((n, s) => n + (s.photos?.length || 0), 0)
    : 0

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Import a Bundle"
        subtitle="Load a prepared data bundle — photos, extracted facts, and system mappings — and apply it to your property record in one step."
      />

      <Card>
        {!bundle ? (
          <label className="block border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors">
            <input type="file" accept=".json,application/json" className="hidden" onChange={loadFile} />
            <p className="font-medium text-ink">Choose a bundle file</p>
            <p className="text-sm text-ink-3 mt-1">.json — nothing uploads anywhere except your own property record</p>
          </label>
        ) : (
          <>
            <div className="mb-4">
              <p className="font-semibold text-ink">{bundle.source || "Bundle"}</p>
              <p className="text-sm text-ink-2 mt-0.5">
                {bundle.systems.length} systems · {totalPhotos} photos
                {bundle.priorities?.length ? ` · ${bundle.priorities.length} suggested priorities` : ""}
              </p>
            </div>
            <ul className="divide-y divide-line mb-4">
              {bundle.systems.map((s, i) => {
                const existing = findSystem(healthApi.items, s.match || [])
                return (
                  <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">
                      {existing ? existing.category : s.create?.category}
                      <span className="text-ink-3">
                        {" "}— {existing ? "update existing" : "new system"}
                      </span>
                    </span>
                    <span className="text-ink-3 shrink-0">
                      {s.photos?.length || 0} photo{(s.photos?.length || 0) === 1 ? "" : "s"}
                    </span>
                  </li>
                )
              })}
            </ul>

            {state === "done" ? (
              <div className="bg-brand-100 rounded-lg p-4">
                <p className="font-medium text-ink mb-2">Bundle applied ✓</p>
                <ul className="text-sm text-ink-2 space-y-0.5">
                  {log.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button onClick={apply} disabled={state === "applying"}>
                  {state === "applying" ? progress || "Applying…" : "Apply to my record"}
                </Button>
                <Button variant="subtle" onClick={() => setBundle(null)} disabled={state === "applying"}>
                  Cancel
                </Button>
              </div>
            )}
            {state === "applying" && log.length > 0 && (
              <ul className="text-xs text-ink-3 mt-3 space-y-0.5">
                {log.map((l, i) => (
                  <li key={i}>✓ {l}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </Card>
    </div>
  )
}
