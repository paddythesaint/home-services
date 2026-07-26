// The two hubs' tab bars. The left nav points at a hub ("Property Record",
// "The Plan"); these tabs are how you move between its pages. Routes are
// unchanged — every old URL still works — the tabs are pure wayfinding.
// Role trims (no vendors for technicians, no money for staff) live in
// roles.js next to the nav keys they replaced.

import { NavLink, useOutletContext } from "react-router-dom"
import { viewFor } from "./roles"
import { Segmented } from "./components"

const RECORD = [
  { key: "health", to: "/health-report", label: "Health of the house" },
  { key: "history", to: "/job-history", label: "Everything we've done" },
  { key: "coverage", to: "/coverage", label: "Coverage" },
  { key: "contractors", to: "/contractors", label: "Contractors" },
]

const PLAN = [
  { key: "calendar", to: "/care-calendar", label: "The year of care" },
  { key: "priorities", to: "/priority-list", label: "What's next" },
  { key: "report", to: "/home-report", label: "Year in review" },
]

// The Simple/Detailed depth control rides on every hub page's tab row —
// the same choice, in the same corner, wherever the record has depth.
function Tabs({ tabs }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 border-b border-line">
      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className={({ isActive }) =>
              `px-3.5 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-brand-600 text-brand-800 font-medium"
                  : "border-transparent text-ink-2 hover:text-ink"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="shrink-0 pb-1.5">
        <Segmented />
      </div>
    </div>
  )
}

export function RecordTabs() {
  const { user } = useOutletContext()
  const allowed = viewFor(user?.email).recordTabs
  return <Tabs tabs={RECORD.filter((t) => allowed.has(t.key))} />
}

export function PlanTabs() {
  const { user } = useOutletContext()
  const allowed = viewFor(user?.email).planTabs
  return <Tabs tabs={PLAN.filter((t) => allowed.has(t.key))} />
}
