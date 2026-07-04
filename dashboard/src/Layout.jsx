import { useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { signOut } from "firebase/auth"
import { auth } from "./firebase"
import { useProperty, usePropertyId } from "./useProperty"
import { subscribeDataErrors } from "./dataErrors"
import { isFounder } from "./founders"

const icons = {
  overview: <path d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  walkthrough: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 13l2 2 4-4" />,
  health: <path d="M22 12h-4l-3 8-4-16-3 8H2" />,
  calendar: <path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />,
  priorities: <path d="M4 21V4m0 0s1-1.5 5-1.5S14 4 14 4s1 1.5 5 1.5c1 0 1.5-.25 1.5-.25v10.5s-.5.25-1.5.25c-4 0-5-1.5-5-1.5s-1-1.5-5-1.5-5 1.5-5 1.5" />,
  history: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  ops: <path d="M3 3v18h18M7 15l3-3 3 3 5-6" />,
  contractors: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  network: <path d="M12 2a3 3 0 100 6 3 3 0 000-6zM5 16a3 3 0 106 0 3 3 0 00-6 0zM13 16a3 3 0 106 0 3 3 0 00-6 0zM10.5 7.5L7 13.5M13.5 7.5L17 13.5M8 16h8" />,
  import: <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />,
}

function NavIcon({ name }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {icons[name]}
    </svg>
  )
}

function buildNavSections(founder) {
  return [
    {
      heading: "Property",
      items: [
        { to: "/", label: "Overview", icon: "overview", end: true },
        { to: "/walkthrough", label: "Walkthrough", icon: "walkthrough" },
        { to: "/import", label: "Import Bundle", icon: "import" },
        { to: "/health-report", label: "Health Report", icon: "health" },
        { to: "/care-calendar", label: "Care Calendar", icon: "calendar" },
        { to: "/priority-list", label: "90-Day Priorities", icon: "priorities" },
        { to: "/job-history", label: "Job History", icon: "history" },
        { to: "/contractors", label: "Contractors", icon: "contractors" },
      ],
    },
    {
      heading: "Business",
      items: [
        { to: "/ops", label: "Command Center", icon: "ops" },
        ...(founder ? [{ to: "/contractor-network", label: "Contractor Network", icon: "network" }] : []),
      ],
    },
  ]
}

export default function Layout({ user }) {
  const { status, propertyId } = usePropertyId(user)
  const { profile, save } = useProperty(propertyId)
  const founder = isFounder(user?.email)
  const navSections = buildNavSections(founder)
  const allNavItems = navSections.flatMap((s) => s.items)

  // Data-layer failures (usually permission-denied from stale published
  // rules) surface as a banner — never as a silently empty page.
  const [dataErrors, setDataErrors] = useState({})
  useEffect(() => subscribeDataErrors(setDataErrors), [])
  const failedCollections = [...new Set(Object.values(dataErrors).map((e) => e.collection))]

  if (status === "resolving" || (status === "ready" && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-plane text-ink-2">
        Loading your property…
      </div>
    )
  }

  if (status === "none") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-plane px-4">
        <div className="bg-surface border border-line rounded-xl p-8 max-w-sm w-full text-center shadow-sm">
          <p className="font-semibold text-ink mb-2">No property yet</p>
          <p className="text-sm text-ink-2 mb-6">
            {user.email} isn't a member of any property yet. Ask an owner to
            invite you from their "People with access" panel, then reload.
          </p>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-plane text-ink flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-brand-900 text-brand-50 p-5">
        <div className="mb-8 px-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-brand-200">
            Charlottesville
          </p>
          <p className="text-base font-semibold leading-snug">
            Home &amp; Property Services
          </p>
        </div>
        <nav className="flex flex-col gap-4">
          {navSections.map((section) => (
            <div key={section.heading} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-300">
                {section.heading}
              </p>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-900 font-medium"
                        : "text-brand-100 hover:bg-brand-800"
                    }`
                  }
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-8 px-2 text-xs text-brand-200 leading-relaxed">
          <p className="font-medium text-brand-100">{profile.tier}</p>
          <p>{profile.address}</p>
          <p>{profile.areaLabel}</p>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="mt-3 text-brand-200 hover:text-white underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-brand-900 text-brand-50">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Home &amp; Property Services</p>
            <button type="button" onClick={() => signOut(auth)} className="text-xs underline">
              Sign out
            </button>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5">
            {allNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-900 font-medium"
                      : "bg-brand-800 text-brand-100"
                  }`
                }
              >
                <NavIcon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <header className="hidden md:flex items-center justify-between border-b border-line bg-surface px-8 py-3.5">
          <div>
            <p className="text-xs text-ink-3">Welcome back</p>
            <p className="text-sm font-semibold text-ink">
              {profile.clientName ? `${profile.clientName} Family` : user.displayName}
            </p>
          </div>
          <div className="text-right text-xs text-ink-2">
            <p>
              Next invoice{" "}
              <span className="font-semibold text-ink">
                {profile.nextInvoiceDate || "—"}
              </span>
            </p>
            <p className="text-ink-3">${profile.monthlyRate || 0}/mo</p>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          {failedCollections.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 mb-4 text-sm">
              <span className="font-medium">Some of your data couldn't load</span> (
              {failedCollections.join(", ")}) — permission was denied, which usually means
              the published Firestore rules are behind the app.{" "}
              {founder
                ? "Run the checks under System status on the Command Center to pinpoint it."
                : "Let your service operator know."}
            </div>
          )}
          <Outlet context={{ uid: propertyId, profile, saveProfile: save, user }} />
        </main>
      </div>
    </div>
  )
}
