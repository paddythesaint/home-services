import { NavLink, Outlet } from "react-router-dom"
import { signOut } from "firebase/auth"
import { auth } from "./firebase"
import { useProperty } from "./useProperty"

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/health-report", label: "Property Health Report" },
  { to: "/care-calendar", label: "Annual Care Calendar" },
  { to: "/priority-list", label: "90-Day Priority List" },
  { to: "/job-history", label: "Job History" },
]

export default function Layout({ user }) {
  const { profile, save } = useProperty(user.uid)

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 text-brand-600">
        Loading your property…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-50 text-brand-900 flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-brand-800 text-brand-50 p-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-brand-200">
            Charlottesville
          </p>
          <p className="text-lg font-semibold leading-tight">
            Home &amp; Property Services
          </p>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-900 font-medium"
                    : "text-brand-100 hover:bg-brand-700"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-8 text-xs text-brand-200">
          <p className="font-medium text-brand-100">{profile.tier}</p>
          <p>{profile.address}</p>
          <p>{profile.areaLabel}</p>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="mt-4 text-brand-300 hover:text-white underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-brand-800 text-brand-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Home &amp; Property Services</p>
          <button type="button" onClick={() => signOut(auth)} className="text-xs underline">
            Sign out
          </button>
        </header>
        <header className="hidden md:flex items-center justify-between border-b border-brand-200 bg-white px-8 py-4">
          <div>
            <p className="text-sm text-brand-600">Welcome back,</p>
            <p className="text-lg font-semibold text-brand-900">
              {profile.clientName ? `${profile.clientName} Family` : user.displayName}
            </p>
          </div>
          <div className="text-right text-sm text-brand-600">
            <p>
              Next invoice:{" "}
              <span className="font-medium text-brand-900">
                {profile.nextInvoiceDate || "—"}
              </span>
            </p>
            <p>${profile.monthlyRate || 0}/mo</p>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet context={{ uid: user.uid, profile, saveProfile: save }} />
        </main>
      </div>
    </div>
  )
}
