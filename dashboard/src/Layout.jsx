import { NavLink, Outlet } from "react-router-dom"
import { client, property } from "./mockData"

const navItems = [
  { to: "/", label: "Overview", end: true },
  { to: "/health-report", label: "Property Health Report" },
  { to: "/care-calendar", label: "Annual Care Calendar" },
  { to: "/priority-list", label: "90-Day Priority List" },
  { to: "/job-history", label: "Job History" },
]

export default function Layout() {
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
          <p className="font-medium text-brand-100">{client.tier}</p>
          <p>{property.address}</p>
          <p>{property.areaLabel}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-brand-800 text-brand-50 px-4 py-3">
          <p className="text-sm font-semibold">Home &amp; Property Services</p>
        </header>
        <header className="hidden md:flex items-center justify-between border-b border-brand-200 bg-white px-8 py-4">
          <div>
            <p className="text-sm text-brand-600">Welcome back,</p>
            <p className="text-lg font-semibold text-brand-900">
              {client.name} Family
            </p>
          </div>
          <div className="text-right text-sm text-brand-600">
            <p>
              Next invoice:{" "}
              <span className="font-medium text-brand-900">
                {client.nextInvoiceDate}
              </span>
            </p>
            <p>
              ${client.monthlyRate}/mo &middot; rate locked for life
            </p>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
