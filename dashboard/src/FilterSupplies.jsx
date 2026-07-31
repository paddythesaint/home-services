import { useState } from "react"
import { useItems } from "./useItems"
import { addItem } from "./firestoreApi"
import { todayLabel } from "./dates"
import {
  AIR_SIZES,
  WATER_TYPES,
  DEFAULT_INTERVAL,
  supplyLabel,
  intervalFor,
  nextDueMs,
  isDue,
  lowStock,
} from "./supplies"
import { Card, Button } from "./components"

// The filters card: the home's consumables at a glance — size, how many
// it takes, how many are on hand, and when they change next. Marking a
// line replaced deducts a full change from stock, stamps the date (which
// slides the next due forward), and logs the job; the stock steppers are
// the one-tap adjust for restocks and corrections.

const CUSTOM = "custom"

const dueLabel = (s) => {
  const d = new Date(nextDueMs(s))
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export default function FilterSupplies({ uid }) {
  const { items, add, update, remove } = useItems(uid, "supplies")
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState("air")
  const [size, setSize] = useState(AIR_SIZES[0])
  const [customSize, setCustomSize] = useState("")
  const [count, setCount] = useState(1)
  const [stock, setStock] = useState(0)
  const [interval, setInterval_] = useState(DEFAULT_INTERVAL.air)
  const [location, setLocation] = useState("")

  const low = new Set(lowStock(items).map((s) => s.id))
  const sizeOptions = kind === "air" ? AIR_SIZES : WATER_TYPES

  function pickKind(k) {
    setKind(k)
    setSize((k === "air" ? AIR_SIZES : WATER_TYPES)[0])
    setInterval_(DEFAULT_INTERVAL[k])
  }

  async function submit(e) {
    e.preventDefault()
    const finalSize = size === CUSTOM ? customSize.trim() : size
    if (!finalSize) return
    await add({
      kind,
      size: finalSize,
      count: Math.max(1, Number(count) || 1),
      stock: Math.max(0, Number(stock) || 0),
      intervalMonths: Number(interval) || DEFAULT_INTERVAL[kind],
      location: location.trim(),
      createdOnMs: Date.now(),
    })
    setAdding(false)
    setCustomSize("")
    setCount(1)
    setStock(0)
    setLocation("")
  }

  async function markReplaced(s) {
    await update(s.id, {
      stock: Math.max(0, (s.stock ?? 0) - (s.count || 1)),
      lastReplacedMs: Date.now(),
    })
    await addItem(uid, "jobHistory", {
      date: todayLabel(),
      title: `Replaced ${supplyLabel(s)} ×${s.count || 1}${s.location ? ` — ${s.location}` : ""}`,
      category: s.kind === "air" ? "HVAC" : "Plumbing",
      sub: "Owner (DIY)",
      status: "completed",
      notes: "Filter replacement.",
    })
  }

  return (
    <Card title="Filters & supplies">
      <p className="text-sm text-ink-2 mb-3">
        What this home takes, what's on hand, and when each changes next.
        Snap a filter's printed edge to the Assistant and it files the size
        here for you.
      </p>

      <ul className="m-0 p-0 list-none mb-4">
        {items.length === 0 && (
          <li className="text-[12.5px] text-ink-4 py-3 border-t border-line">
            Nothing tracked yet — add the sizes this home takes.
          </li>
        )}
        {items.map((s) => (
          <li
            key={s.id}
            className="py-2.5 border-t border-line last:border-b flex flex-wrap items-baseline gap-x-4 gap-y-1 group"
          >
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium text-ink">{supplyLabel(s)}</span>
              {s.location && (
                <span className="text-xs text-ink-3 ml-2">{s.location}</span>
              )}
              <span className="block text-[11.5px] text-ink-3">
                takes {s.count || 1} · every {intervalFor(s)} mo ·{" "}
                {isDue(s) ? (
                  <span className="text-status-warn font-medium">due now</span>
                ) : (
                  `next ${dueLabel(s)}`
                )}
              </span>
            </span>
            <span className="shrink-0 flex items-center gap-2">
              <span
                className={`numeric text-[12px] ${low.has(s.id) ? "text-status-critical font-semibold" : "text-ink-2"}`}
              >
                {s.stock ?? 0} on hand{low.has(s.id) ? " — low" : ""}
              </span>
              <button
                type="button"
                aria-label={`One fewer ${supplyLabel(s)}`}
                className="text-ink-3 hover:text-ink text-sm px-1"
                onClick={() => update(s.id, { stock: Math.max(0, (s.stock ?? 0) - 1) })}
              >
                −
              </button>
              <button
                type="button"
                aria-label={`One more ${supplyLabel(s)}`}
                className="text-ink-3 hover:text-ink text-sm px-1"
                onClick={() => update(s.id, { stock: (s.stock ?? 0) + 1 })}
              >
                +
              </button>
              <button
                type="button"
                className="text-brand-600 hover:text-brand-800 text-xs font-medium"
                onClick={() => markReplaced(s)}
              >
                replaced
              </button>
              <button
                type="button"
                className="text-status-critical/70 hover:text-status-critical text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => remove(s.id)}
              >
                delete
              </button>
            </span>
          </li>
        ))}
      </ul>

      {!adding ? (
        <Button variant="subtle" onClick={() => setAdding(true)}>
          + Add filter
        </Button>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={submit}>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1 text-xs text-ink-3">
              Type
              <select
                value={kind}
                onChange={(e) => pickKind(e.target.value)}
                className="mt-1 w-full border border-line rounded-lg px-2 py-2 bg-surface text-ink text-sm"
              >
                <option value="air">Air filter</option>
                <option value="water">Water filter</option>
              </select>
            </label>
            <label className="flex-1 text-xs text-ink-3">
              {kind === "air" ? "Size" : "Which one"}
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="mt-1 w-full border border-line rounded-lg px-2 py-2 bg-surface text-ink text-sm"
              >
                {sizeOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value={CUSTOM}>Custom…</option>
              </select>
            </label>
            {size === CUSTOM && (
              <label className="flex-1 text-xs text-ink-3">
                Custom size / model
                <input
                  type="text"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder={kind === "air" ? "e.g. 12x24x1" : "e.g. Samsung HAF-CIN"}
                  className="mt-1 w-full border border-line rounded-lg px-3 py-2 bg-surface text-ink text-sm"
                />
              </label>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1 text-xs text-ink-3">
              How many it takes
              <input
                type="number"
                min="1"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="mt-1 w-full border border-line rounded-lg px-3 py-2 bg-surface text-ink text-sm"
              />
            </label>
            <label className="flex-1 text-xs text-ink-3">
              On hand now
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="mt-1 w-full border border-line rounded-lg px-3 py-2 bg-surface text-ink text-sm"
              />
            </label>
            <label className="flex-1 text-xs text-ink-3">
              Change every
              <select
                value={interval}
                onChange={(e) => setInterval_(e.target.value)}
                className="mt-1 w-full border border-line rounded-lg px-2 py-2 bg-surface text-ink text-sm"
              >
                {[1, 2, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m === 12 ? "12 months (yearly)" : `${m} month${m === 1 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-xs text-ink-3">
              Where (optional)
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. upstairs return, fridge"
                className="mt-1 w-full border border-line rounded-lg px-3 py-2 bg-surface text-ink text-sm"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Add</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
