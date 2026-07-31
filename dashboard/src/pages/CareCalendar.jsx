import { useState } from "react"
import { PlanTabs } from "../HubTabs"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { addItem, updateItem } from "../firestoreApi"
import { todayLabel } from "../dates"
import { upcomingByMonth, replacementSummary, isDue, supplyLabel } from "../supplies"
import { tradeForItem } from "../trades"
import { starterCalendar, seasonFor, SEASON_LABEL } from "../maintenanceIntelligence"
import { climateFor } from "../climate"
import {
  Card,
  PageHeader,
  Button,
  Modal,
  DynamicForm,
  Detail,
  Figure,
  FigureRow,
} from "../components"

const SEASON_ORDER = ["spring", "summer", "fall", "winter"]
const NUM_WORDS = [
  "No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen", "Twenty", "Twenty-one", "Twenty-two",
  "Twenty-three", "Twenty-four", "Twenty-five",
]

const THIS_YEAR = new Date().getFullYear()
export const isDoneThisYear = (item) => item.doneYear === THIS_YEAR

const jobFields = [
  { name: "date", label: "When was it done?", type: "text" },
  { name: "sub", label: "Who did it?", type: "text", placeholder: "e.g. Owner (DIY) or company name" },
  { name: "cost", label: "Cost", type: "text", placeholder: "optional" },
]

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const CURRENT_MONTH = MONTHS[new Date().getMonth()]

const fields = [
  { name: "month", label: "Month", type: "select", options: MONTHS },
  { name: "task", label: "Task", type: "text", placeholder: "e.g. Irrigation startup" },
]

export default function CareCalendar() {
  const { uid, profile } = useOutletContext()
  const { items, add, update, remove } = useItems(uid, "careCalendar")
  const { items: supplies } = useItems(uid, "supplies")
  const [seeding, setSeeding] = useState(false)

  // Filter replacements are derived rows, not stored tasks: each line's due
  // month comes from lastReplaced + its interval (see supplies.js), so
  // marking a change done slides the schedule forward by itself.
  const filterMonths = upcomingByMonth(supplies)

  async function replaceFilters(lines) {
    for (const s of lines) {
      await updateItem(uid, "supplies", s.id, {
        stock: Math.max(0, (s.stock ?? 0) - (s.count || 1)),
        lastReplacedMs: Date.now(),
      })
    }
    await addItem(uid, "jobHistory", {
      date: todayLabel(),
      title: `Replaced filters — ${lines.map((s) => `${supplyLabel(s)} ×${s.count || 1}`).join(", ")}`,
      category: "HVAC",
      sub: "Owner (DIY)",
      status: "completed",
      notes: "Filter schedule.",
    })
  }

  // An empty calendar offers the climate-tailored starter plan instead of a
  // blank grid — nobody should have to author a year of maintenance rhythm.
  async function seedStarter() {
    setSeeding(true)
    try {
      for (const t of starterCalendar(profile)) await add(t)
    } finally {
      setSeeding(false)
    }
  }
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loggingJob, setLoggingJob] = useState(null) // task just marked done

  // Done is per-year: the stamp names this year, so every January the
  // schedule resets itself without anyone touching it.
  async function markDone(item) {
    await update(item.id, { doneOn: todayLabel(), doneYear: THIS_YEAR })
    setLoggingJob(item)
  }

  // 4b derivations: the year bucketed by this home's climate seasons.
  const region = climateFor(profile)
  const currentSeason = seasonFor(new Date(), region)
  const doneCount = items.filter(isDoneThisYear).length
  const heaviestMonth = MONTHS.reduce(
    (best, m) => {
      const c = items.filter((i) => i.month === m).length
      return c > best.count ? { month: m, count: c } : best
    },
    { month: "", count: 0 }
  ).month

  return (
    <div>
      <PlanTabs />
      <PageHeader
        title={`${NUM_WORDS[items.length] || items.length} visit${items.length === 1 ? "" : "s"} a year,`}
        clause={
          doneCount > 0
            ? `${doneCount} already handled in ${THIS_YEAR}.`
            : "each in its season."
        }
        subtitle="The rhythm of care for this home — seasons carry it, not a wall of months. Mark things done as they happen; each one can flow into the job history."
        action={<Button onClick={() => setEditing("new")}>+ Add task</Button>}
      />
      {items.length === 0 && (
        <Card className="mb-4">
          <p className="text-sm text-ink-2 mb-2">
            No care tasks yet. Start with the seasonal plan for this home's climate — a year
            of sensible maintenance rhythm you can then tune.
          </p>
          <Button variant="subtle" onClick={seedStarter} disabled={seeding}>
            {seeding ? "Adding…" : "Add the seasonal starter plan"}
          </Button>
        </Card>
      )}

      {/* 4b: four season blocks, hairline task pairs, no month grid. */}
      <div className="flex flex-col gap-7">
        {SEASON_ORDER.map((season) => {
          // Start the range where the season actually starts — winter wraps
          // the year (DEC–FEB), so begin at the month whose predecessor is
          // outside the season.
          const inSeason = (i) => region.seasonByMonth[((i % 12) + 12) % 12] === season
          const startIdx = MONTHS.findIndex((_, i) => inSeason(i) && !inSeason(i - 1))
          const monthsIn = []
          for (let i = startIdx; startIdx >= 0 && inSeason(i); i++) monthsIn.push(MONTHS[((i % 12) + 12) % 12])
          const seasonItems = items
            .filter((i) => region.seasonByMonth[MONTHS.indexOf(i.month)] === season)
            .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month) || (a.order || 0) - (b.order || 0))
          const range = monthsIn.length
            ? `${monthsIn[0].slice(0, 3)}–${monthsIn[monthsIn.length - 1].slice(0, 3)}`.toUpperCase()
            : ""
          const now = season === currentSeason
          // Derived filter-change rows falling in this season's months.
          const filterRows = monthsIn
            .map((name) => MONTHS.indexOf(name))
            .filter((idx) => filterMonths.has(idx))
            .map((idx) => ({ idx, lines: filterMonths.get(idx) }))
          return (
            <div key={season} className="grid grid-cols-1 md:grid-cols-[132px_1fr] gap-x-6 gap-y-2">
              <div>
                <p className="font-display m-0 text-[20px] text-ink capitalize">{SEASON_LABEL[season] || season}</p>
                <p className="numeric m-0 mt-0.5 text-[10.5px] text-ink-3">
                  {range}
                  {now && <span className="text-status-good"> · NOW</span>}
                </p>
              </div>
              <ul className="m-0 p-0 list-none">
                {seasonItems.length === 0 && filterRows.length === 0 && (
                  <li className="text-[12.5px] text-ink-4 py-3 border-t border-line">
                    Nothing scheduled.
                  </li>
                )}
                {seasonItems.map((item) => {
                  const done = isDoneThisYear(item)
                  return (
                    <li
                      key={item.id}
                      className="flex items-baseline justify-between gap-4 py-3 border-t border-line last:border-b group"
                    >
                      <span className={`text-sm ${done ? "text-ink-4 line-through" : "font-medium text-ink"}`}>
                        <Link
                          to={`/health-report#trade-${tradeForItem(item).key}`}
                          className="hover:text-brand-700"
                        >
                          {item.task}
                        </Link>
                        {done && (
                          <span className="numeric no-underline uppercase text-[10.5px] text-status-good ml-2 tracking-wide">
                            · done {item.doneOn}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 flex items-baseline gap-3">
                        {!done && (
                          <button
                            type="button"
                            className="text-brand-600 hover:text-brand-800 text-xs font-medium"
                            onClick={() => markDone(item)}
                          >
                            mark done
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-ink-3 hover:text-ink text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setEditing(item)}
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          className="text-status-critical/70 hover:text-status-critical text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setConfirmDelete(item)}
                        >
                          delete
                        </button>
                        <span className="numeric text-[11px] text-ink-3 w-20 text-right">{item.month.slice(0, 3)}</span>
                      </span>
                    </li>
                  )
                })}
                {/* Derived from the filter ledger (Record → Health): the
                    row rides its due month and slides forward when marked
                    replaced — nothing to maintain here. */}
                {filterRows.map(({ idx, lines }) => {
                  const due = lines.some((s) => isDue(s))
                  return (
                    <li
                      key={`filters-${idx}`}
                      className="flex items-baseline justify-between gap-4 py-3 border-t border-line last:border-b"
                    >
                      <span className={`text-sm ${due ? "font-medium text-ink" : "text-ink-2"}`}>
                        <Link to="/health-report" className="hover:text-brand-700">
                          Replace filters — {replacementSummary(lines)}
                        </Link>
                        <span className="numeric uppercase text-[10.5px] text-ink-3 ml-2 tracking-wide">
                          · supplies
                        </span>
                      </span>
                      <span className="shrink-0 flex items-baseline gap-3">
                        {due && (
                          <button
                            type="button"
                            className="text-brand-600 hover:text-brand-800 text-xs font-medium"
                            onClick={() => replaceFilters(lines)}
                          >
                            mark replaced
                          </button>
                        )}
                        <span className="numeric text-[11px] text-ink-3 w-20 text-right">
                          {MONTHS[idx].slice(0, 3)}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Operator depth: the year's shape in figures. */}
      <Detail>
        <div className="mt-9 bg-sunk rounded-(--radius-block) p-5">
          <FigureRow cols={4}>
            <Figure lead value={items.length} label="visits planned" />
            <Figure value={doneCount} label={`handled in ${THIS_YEAR}`} />
            <Figure value={items.length - doneCount} label="still ahead" />
            <Figure value={heaviestMonth || "—"} label="heaviest month" />
          </FigureRow>
        </div>
      </Detail>

      {editing && (
        <Modal title={editing === "new" ? "Add task" : "Edit task"} onClose={() => setEditing(null)}>
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? { month: CURRENT_MONTH } : editing}
            onSubmit={(values) => {
              if (editing === "new") {
                add(values)
              } else {
                update(editing.id, values)
              }
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {loggingJob && (
        <Modal
          title={`Done — log "${loggingJob.task}" as a job?`}
          onClose={() => setLoggingJob(null)}
        >
          <p className="text-sm text-ink-2 mb-4">
            The task is checked off for {THIS_YEAR}. Logging it as a job keeps the
            history complete — who did it, when, and what it cost.
          </p>
          <DynamicForm
            fields={jobFields}
            initialValues={{ date: todayLabel(), sub: "Owner (DIY)" }}
            submitLabel="Log job"
            onSubmit={async (v) => {
              await addItem(uid, "jobHistory", {
                date: v.date || todayLabel(),
                title: loggingJob.task,
                category: tradeForItem(loggingJob).label,
                sub: v.sub || "",
                cost: v.cost || "",
                status: "completed",
                notes: "Care calendar task.",
              })
              setLoggingJob(null)
            }}
          />
          <div className="flex justify-end mt-2">
            <Button variant="ghost" onClick={() => setLoggingJob(null)}>
              Skip — just check it off
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete task?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{confirmDelete.task}" from {confirmDelete.month}?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                remove(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
