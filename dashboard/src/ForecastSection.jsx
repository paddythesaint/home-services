import { Link } from "react-router-dom"
import { useItems } from "./useItems"
import { replacementHorizon, fmtMoneyRange } from "./benchmarks"
import { buildForecast } from "./forecast"
import { Card, StatTile } from "./components"

// The 3-year cost outlook, formerly its own Plan tab (pages/Forecast.jsx),
// folded into the Home Report with the 7/24 UX cleanups — one money page,
// not two. Same computation, same tiles and tables.

const STATUS_META = {
  past: { label: "Beyond typical life", color: "var(--color-status-critical)" },
  "in-window": { label: "In replacement window", color: "var(--color-status-critical)" },
  approaching: { label: "Window opens soon", color: "var(--color-status-warn)" },
  healthy: { label: "Healthy", color: "var(--color-status-good)" },
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || STATUS_META.healthy
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 whitespace-nowrap">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: meta.color }}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  )
}

export default function ForecastSection({ uid }) {
  const { items: systems, loading } = useItems(uid, "healthReport")
  const { items: priorities } = useItems(uid, "priorityList")

  const forecast = buildForecast(systems, priorities)
  const outlook = systems
    .map((s) => ({ system: s, horizon: replacementHorizon(s) }))
    .filter((x) => x.horizon)
    .sort((a, b) => a.horizon.windowStart - b.horizon.windowStart)
  const flagged = outlook.filter((x) => x.horizon.status !== "healthy")
  const missingYear = systems.filter((s) => !s.installYear).length

  if (loading) return null

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl font-semibold text-ink mb-1">
        Looking ahead — the 3-year forecast
      </h2>
      <p className="text-sm text-ink-3 mb-4">
        Planning ranges computed from each system's age against typical lifespans, plus open
        priorities with cost estimates. Typical figures — not quotes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatTile
          label="Expected over 3 years"
          value={forecast.grand[1] > 0 ? fmtMoneyRange(forecast.grand) : "—"}
          sub="Replacements + open priorities"
        />
        <StatTile
          label="Systems flagged"
          value={flagged.length}
          sub="In or approaching their window"
        />
        <StatTile
          label="Systems with a lifespan read"
          value={`${outlook.length}/${systems.length}`}
          sub={missingYear > 0 ? `${missingYear} missing an install year` : "All install years known"}
        />
      </div>

      {forecast.years.map((y) => (
        <div key={y.year} className="mb-4">
          <Card title={String(y.year)}>
            {y.items.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing forecast for this year.</p>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {y.items.map((item, idx) => (
                    <li key={idx} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{item.label}</p>
                        <p className="text-xs text-ink-3">{item.sub}</p>
                      </div>
                      <span className="text-sm text-ink-2 shrink-0 whitespace-nowrap">
                        {fmtMoneyRange(item.cost, item.costUnit)}
                      </span>
                    </li>
                  ))}
                </ul>
                {y.total[1] > 0 && (
                  <p className="text-sm font-semibold text-ink mt-3 pt-3 border-t border-line text-right">
                    Year total {fmtMoneyRange(y.total)}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      ))}

      <Card title="Systems outlook">
        {outlook.length === 0 ? (
          <p className="text-sm text-ink-2">
            No lifespan reads yet — add install years to systems on the{" "}
            <Link to="/health-report" className="underline">
              Health Report
            </Link>{" "}
            (nameplate photos usually have them) and this fills in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="py-1.5 pr-3 font-semibold">System</th>
                  <th className="py-1.5 pr-3 font-semibold">Age</th>
                  <th className="py-1.5 pr-3 font-semibold">Typical life</th>
                  <th className="py-1.5 pr-3 font-semibold">Window</th>
                  <th className="py-1.5 pr-3 font-semibold">Typical cost</th>
                  <th className="py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {outlook.map(({ system, horizon }) => (
                  <tr key={system.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium text-ink">
                      <Link to={`/system/${system.id}`} className="hover:text-brand-700">
                        {system.category}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-ink-2">{horizon.age} yrs</td>
                    <td className="py-2 pr-3 text-ink-2">
                      {horizon.benchmark.lifeYears[0]}–{horizon.benchmark.lifeYears[1]} yrs
                    </td>
                    <td className="py-2 pr-3 text-ink-2">
                      {horizon.windowStart}–{horizon.windowEnd}
                    </td>
                    <td className="py-2 pr-3 text-ink-2">
                      {fmtMoneyRange(horizon.benchmark.replaceCost, horizon.benchmark.costUnit)}
                    </td>
                    <td className="py-2">
                      <StatusChip status={horizon.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {missingYear > 0 && outlook.length > 0 && (
          <p className="text-xs text-ink-3 mt-3">
            {missingYear} system{missingYear === 1 ? "" : "s"} missing an install year — add one
            on the Health Report and it joins this outlook.
          </p>
        )}
      </Card>
    </div>
  )
}
