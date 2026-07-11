import { useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { PlanTabs } from "../HubTabs"
import { useItems } from "../useItems"
import { jobTime } from "../jobHistoryView"
import { annualReport, fmtDollars } from "../spendInsights"
import { coverageStatus } from "../warranties"
import { Card, PageHeader, StatTile } from "../components"

// The annual "state of your home" report: what the household invested in the
// home this year, where it went, month by month, and who did the work —
// pulled straight from Job History, paired with the care and coverage record.
// Backward-looking, homeowner-facing; the calm counterpart to the forecast.

function Bar({ share }) {
  return (
    <div className="h-2 rounded-full bg-plane overflow-hidden mt-1">
      <div
        className="h-full rounded-full bg-brand-500"
        style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
      />
    </div>
  )
}

export default function HomeReport() {
  const { uid } = useOutletContext()
  const { items: jobs, loading } = useItems(uid, "jobHistory")
  const { items: systems } = useItems(uid, "healthReport")
  const { items: warranties } = useItems(uid, "warranties")

  // Years present in the record, newest first — the report scopes to one.
  const years = useMemo(() => {
    const set = new Set()
    for (const j of jobs) {
      const t = jobTime(j)
      if (!Number.isNaN(t)) set.add(new Date(t).getFullYear())
    }
    return [...set].sort((a, b) => b - a)
  }, [jobs])

  const [year, setYear] = useState(null)
  const activeYear = year ?? years[0] ?? new Date().getFullYear()

  const report = useMemo(
    () => annualReport(jobs, systems, activeYear),
    [jobs, systems, activeYear]
  )

  const coverageLive = warranties.filter((w) =>
    ["active", "expiring"].includes(coverageStatus(w))
  ).length
  const coverageExpiring = warranties.filter((w) => coverageStatus(w) === "expiring").length

  if (loading) return <p className="text-ink-2">Loading your home report…</p>

  return (
    <div>
      <PlanTabs />
      <PageHeader
        title="Your Home, in Review"
        subtitle="What's been invested in the home, where it went, and the care behind it — a yearly look drawn from your record."
        action={
          years.length > 1 ? (
            <select
              className="border border-line rounded-xl px-3 py-2 bg-surface text-ink text-sm"
              value={activeYear}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Report year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile
          label={`Invested in ${activeYear}`}
          value={report.total > 0 ? fmtDollars(report.total) : "—"}
          sub={`${report.jobCount} job${report.jobCount === 1 ? "" : "s"} completed`}
        />
        <StatTile
          label="Biggest area"
          value={report.topTrade ? report.topTrade.label : "—"}
          sub={report.topTrade ? fmtDollars(report.topTrade.amount) : "No spend logged"}
        />
        <StatTile
          label="Systems tracked"
          value={report.systemsTracked}
          sub={`${report.systemsVerified} verified in person`}
        />
        <StatTile
          label="Coverage in force"
          value={coverageLive}
          sub={coverageExpiring > 0 ? `${coverageExpiring} expiring soon` : "Warranties & plans"}
        />
      </div>

      {report.jobCount === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            No completed jobs recorded for {activeYear} yet. As work is logged to Job History,
            this fills in with where the investment went and the care behind it.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <Card title="Where your investment went">
              <div className="flex flex-col gap-3">
                {report.byTrade.map((t) => (
                  <div key={t.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-ink">{t.label}</span>
                      <span className="text-ink-2 whitespace-nowrap">
                        {fmtDollars(t.amount)}
                        <span className="text-ink-3">
                          {" "}
                          · {Math.round(t.share * 100)}% · {t.count} job{t.count === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>
                    <Bar share={t.share} />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {report.byMonth.length > 0 && (
            <div className="mb-4">
              <Card title="Month by month">
                <ul className="flex flex-col gap-2">
                  {report.byMonth.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-2 w-32 shrink-0">{m.label}</span>
                      <div className="flex-1">
                        <Bar share={report.total > 0 ? m.amount / report.total : 0} />
                      </div>
                      <span className="text-ink-2 whitespace-nowrap w-24 text-right">
                        {fmtDollars(m.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {report.byContractor.length > 0 && (
            <Card title="Who did the work">
              <ul className="divide-y divide-line">
                {report.byContractor.map((c) => (
                  <li
                    key={c.name}
                    className="py-2 flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-ink">
                      {c.name}
                      <span className="text-ink-3">
                        {" "}
                        · {c.count} job{c.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-ink-2 whitespace-nowrap">{fmtDollars(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
