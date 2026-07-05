import { useEffect, useState } from "react"
import { Button } from "./components"

// First-login guided tour: a dimmed overlay with a spotlight ring on the
// real UI and a small card that walks through a handful of stops. Steps
// come from tourSteps.js (role-aware); Layout shows it once per device
// (localStorage) with a replay link in the sidebar. No library — a step
// either anchors to a [data-tour="…"] element or falls back to a centered
// card (which is also the mobile behavior, where the sidebar is hidden).

export const TOUR_SEEN_KEY = "hpsTourSeen"

export function tourSeen() {
  try {
    return Boolean(localStorage.getItem(TOUR_SEEN_KEY))
  } catch {
    return true // storage unavailable: never nag
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1")
  } catch {
    /* private mode — the tour just reappears next visit */
  }
}

const CARD_W = 352

export default function Tour({ steps, onClose }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[i]

  useEffect(() => {
    if (!step?.target) {
      setRect(null)
      return
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView?.({ block: "nearest" }) // absent in jsdom
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom })
  }, [i, step?.target])

  if (!step) return null
  const last = i === steps.length - 1

  const cardStyle = rect
    ? {
        position: "fixed",
        top: Math.min(rect.bottom + 14, Math.max(window.innerHeight - 260, 16)),
        left: Math.min(Math.max(rect.left, 16), Math.max(window.innerWidth - CARD_W - 16, 16)),
        width: CARD_W,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: CARD_W,
        maxWidth: "calc(100vw - 32px)",
      }

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-brand-950/55" aria-hidden="true" />
      {rect && (
        <div
          aria-hidden="true"
          className="absolute rounded-xl ring-4 ring-white/90 shadow-(--shadow-raised) pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        role="dialog"
        aria-label={step.title}
        style={cardStyle}
        className="bg-surface rounded-2xl shadow-(--shadow-raised) p-5"
      >
        <p className="font-display text-lg font-semibold text-ink">{step.title}</p>
        <p className="text-sm text-ink-2 mt-1.5 whitespace-pre-line">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="flex gap-1.5" aria-hidden="true">
            {steps.map((_, d) => (
              <span
                key={d}
                className={`w-1.5 h-1.5 rounded-full ${d === i ? "bg-brand-700" : "bg-line"}`}
              />
            ))}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Skip
            </Button>
            <Button onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? "Done" : "Next"}
            </Button>
          </span>
        </div>
      </div>
    </div>
  )
}
