import { useEffect, useMemo, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { subscribePhotos } from "../firestoreApi"
import { callClaude } from "../assistantApi"
import { todayLabel } from "../dates"
import { Card, PageHeader, Button } from "../components"

const EXTERIOR_HINT = /exterior|roof|siding|grounds|gutter|structure/i

const PROMPT = `You are estimating two things from these exterior photos of a house, taken together as one set (dedupe windows you see repeated across photos from different angles or distances):

1. Total distinct windows visible across all photos combined.
2. Total gutter / roofline linear footage, estimated using standard residential reference objects visible in the photos for scale (a door is typically ~36in / 3ft wide, a window ~30-36in wide, a brick course ~8in).

Give your best estimate even under uncertainty — never refuse or say you can't tell. Respond with ONLY a JSON object, no markdown fences, no other text:
{"windowCount":{"estimate":<number>,"confidence":"low"|"medium"|"high","reasoning":"<one sentence>"},"gutterFootage":{"estimateFt":<number>,"confidence":"low"|"medium"|"high","reasoning":"<one sentence>"},"notes":"<any caveats, one sentence>"}`

function parseEstimate(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  return JSON.parse(cleaned)
}

const CONFIDENCE_COLOR = {
  high: "var(--color-status-good)",
  medium: "var(--color-status-warn)",
  low: "var(--color-status-critical)",
}

function ConfidenceChip({ level }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: CONFIDENCE_COLOR[level] || "var(--color-ink-3)" }}
        aria-hidden="true"
      />
      {level || "unknown"} confidence
    </span>
  )
}

export default function ExteriorMeasurements() {
  const { uid, profile, saveProfile } = useOutletContext()
  const { items: systems } = useItems(uid, "healthReport")
  const priorityApi = useItems(uid, "priorityList")
  const [systemId, setSystemId] = useState("")
  const [photos, setPhotos] = useState(null)
  const [state, setState] = useState("idle") // idle | running | error | done
  const [result, setResult] = useState(profile.exteriorEstimate || null)
  const [errorMsg, setErrorMsg] = useState("")
  const [filledCount, setFilledCount] = useState(0)

  useEffect(() => {
    if (systemId || systems.length === 0) return
    const guess = systems.find((s) => EXTERIOR_HINT.test(`${s.category} ${s.detail}`))
    setSystemId((guess || systems[0]).id)
  }, [systems, systemId])

  useEffect(() => {
    if (!systemId) return
    return subscribePhotos(uid, systemId, setPhotos)
  }, [uid, systemId])

  const usablePhotos = useMemo(() => (photos || []).slice(0, 12), [photos])

  async function runEstimate() {
    setState("running")
    setErrorMsg("")
    try {
      const content = [
        ...usablePhotos.map((p) => ({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: p.dataUrl.split(",")[1] },
        })),
        { type: "text", text: PROMPT },
      ]
      const data = await callClaude(profile.anthropicApiKey, undefined, [
        { role: "user", content },
      ])
      const textBlock = data.content.find((b) => b.type === "text")
      const parsed = parseEstimate(textBlock.text)
      const record = { ...parsed, estimatedOn: todayLabel(), photoCount: usablePhotos.length }
      setResult(record)
      await saveProfile({ exteriorEstimate: record })

      // Auto-fill Slice 5 measurement asks that mention windows or gutters.
      let filled = 0
      for (const p of priorityApi.items) {
        const info = p.infoNeeded || []
        const next = info.map((i) => {
          if (i.type !== "measurement" || i.status === "provided") return i
          if (/window/i.test(i.ask)) {
            filled++
            return {
              ...i,
              status: "provided",
              answer: `~${parsed.windowCount.estimate} windows (estimated, ${parsed.windowCount.confidence} confidence)`,
            }
          }
          if (/gutter/i.test(i.ask)) {
            filled++
            return {
              ...i,
              status: "provided",
              answer: `~${parsed.gutterFootage.estimateFt} ft (estimated, ${parsed.gutterFootage.confidence} confidence)`,
            }
          }
          return i
        })
        if (next.some((i, idx) => i !== info[idx])) {
          await priorityApi.update(p.id, { infoNeeded: next })
        }
      }
      setFilledCount(filled)
      setState("done")
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message.includes("401") ? "That API key was rejected." : err.message)
      setState("error")
    }
  }

  if (!profile.anthropicApiKey) {
    return (
      <div>
        <PageHeader
          title="Exterior Measurements"
          subtitle="Estimate window count and gutter footage from your exterior photos."
        />
        <Card>
          <p className="text-sm text-ink-2">
            This uses the same Claude connection as the Intake Assistant.{" "}
            <Link to="/assistant" className="underline">
              Connect it there
            </Link>{" "}
            first, then come back.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Exterior Measurements"
        subtitle="Vision estimate from your exterior photos — always labeled as an estimate, never a substitute for a measured quote."
      />

      <Card>
        <label className="flex flex-col gap-1 text-sm mb-4">
          <span className="font-medium text-ink-2">Photos to analyze</span>
          <select
            className="border border-line rounded-lg px-3 py-2 bg-surface text-ink"
            value={systemId}
            onChange={(e) => setSystemId(e.target.value)}
          >
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.category}
                {s.detail ? ` — ${s.detail}` : ""}
              </option>
            ))}
          </select>
        </label>

        {photos === null ? (
          <p className="text-sm text-ink-3">Loading photos…</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-ink-3">
            No photos on this system yet. Add exterior photos on the Health Report or via the
            Intake Assistant, then come back here.
          </p>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap mb-4">
              {usablePhotos.map((p) => (
                <img
                  key={p.id}
                  src={p.dataUrl}
                  alt="Exterior"
                  className="w-16 h-16 object-cover rounded-md border border-line"
                />
              ))}
            </div>
            {photos.length > usablePhotos.length && (
              <p className="text-xs text-ink-3 mb-3">
                Using the first {usablePhotos.length} of {photos.length} photos.
              </p>
            )}
            <Button onClick={runEstimate} disabled={state === "running"}>
              {state === "running" ? "Estimating…" : "Run estimate"}
            </Button>
          </>
        )}

        {errorMsg && <p className="text-sm text-red-600 mt-3">{errorMsg}</p>}
      </Card>

      {result && (
        <div className="mt-4">
          <Card title="Estimate">
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-ink">Windows</p>
                  <ConfidenceChip level={result.windowCount?.confidence} />
                </div>
                <p className="text-2xl font-semibold text-ink mt-0.5">
                  ~{result.windowCount?.estimate}
                </p>
                <p className="text-xs text-ink-3 mt-1">{result.windowCount?.reasoning}</p>
              </div>
              <div className="pt-4 border-t border-line">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-ink">Gutter footage</p>
                  <ConfidenceChip level={result.gutterFootage?.confidence} />
                </div>
                <p className="text-2xl font-semibold text-ink mt-0.5">
                  ~{result.gutterFootage?.estimateFt} ft
                </p>
                <p className="text-xs text-ink-3 mt-1">{result.gutterFootage?.reasoning}</p>
              </div>
              {result.notes && (
                <p className="text-xs text-ink-3 pt-3 border-t border-line">{result.notes}</p>
              )}
              <p className="text-xs text-ink-3">
                Estimated {result.estimatedOn} from {result.photoCount} photo
                {result.photoCount === 1 ? "" : "s"} — verify before quoting.
                {filledCount > 0 &&
                  ` Filled in ${filledCount} matching info request${filledCount === 1 ? "" : "s"} on open priorities.`}
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
