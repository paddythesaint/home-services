// The two hubs' tab bars. The left nav points at a hub ("Record", "Plan");
// these tabs are how you move between its pages. Routes are unchanged —
// every old URL still works — the tabs are pure wayfinding. Role trims
// (no vendors for technicians, no money for staff) live in roles.js next
// to the nav keys they replaced.
//
// One name per destination: these labels are THE names — the sidebar, the
// bottom tab bar, and every inline reference use the same words.

import { NavLink, useOutletContext } from "react-router-dom"
import { viewFor } from "./roles"
import { Segmented } from "./components"

const RECORD = [
  { key: "health", to: "/health-report", label: "Health of the house" },
  { key: "history", to: "/job-history", label: "Service history" },
  { key: "coverage", to: "/coverage", label: "Coverage" },
  { key: "contractors", to: "/contractors", label: "Contractors" },
]

const PLAN = [
  { key: "calendar", to: "/care-calendar", label: "Year of care" },
  { key: "priorities", to: "/priority-list", label: "What's next" },
  { key: "report", to: "/home-report", label: "Year in review" },
]

// The Simple/Detailed depth control rides on every hub page's tab row.
// On phones the tabs get the full width to themselves (the pill moves to
// its own line above) — sharing a row squeezed later tabs clean off the
// screen with no hint they existed. The right-edge fade says "more here".
function Tabs({ tabs }) {
  return (
    <div className="mb-5">
      <div className="flex justify-end sm:hidden mb-1.5">
        <Segmented />
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-line">
        <div
          className="flex gap-1 overflow-x-auto w-full [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
          role="tablist"
        >
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
        <div className="shrink-0 pb-1.5 hidden sm:block">
          <Segmented />
        </div>
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
