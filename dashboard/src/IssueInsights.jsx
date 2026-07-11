// The staff-facing read on the 90-day list: not a flat set of chores but
// the conditions beneath them. Clusters related priorities into an issue,
// shows what it calcifies into if deferred, flags likely duplicates, and
// names the coordinated fix — the intelligence that turns scattered tickets
// into one action. Homeowners keep the calm list; this is an operator tool.

import { Link } from "react-router-dom"
import { UrgencyBadge, Card } from "./components"
import { fmtMoneyRange } from "./benchmarks"
import { detectIssues, escalationCeiling, consequenceLine } from "./issuePlaybook"

export default function IssueInsights({ priorities, onBundle }) {
  const clusters = detectIssues(priorities)
  if (clusters.length === 0) return null

  return (
    <Card title="Related items & escalation risk" className="mb-4">
      <p className="text-xs text-ink-3 mb-3">
        {clusters.length} underlying issue{clusters.length === 1 ? "" : "s"} connect several
        open priorities. Resolving each as one coordinated action beats closing the symptoms
        one ticket at a time.
      </p>
      <div className="flex flex-col gap-4">
        {clusters.map(({ issue, items, duplicates }) => {
          const dupIds = new Set(duplicates.flat())
          // Items not already carried on a work order — the ones a bundle
          // would newly pull in.
          const unlinked = items.filter((p) => !p.workOrderId)
          const allRaised = unlinked.length === 0
          return (
            <div key={issue.key} className="border border-line rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{issue.title}</p>
                  <p className="text-xs text-ink-2 mt-0.5">{issue.rootCause}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                  up to {fmtMoneyRange([escalationCeiling(issue), escalationCeiling(issue)])} if
                  deferred
                </span>
              </div>

              <ul className="mt-2.5 flex flex-col gap-1">
                {items.map((p) => (
                  <li key={p.id} className="text-sm text-ink flex items-start justify-between gap-3">
                    <span>
                      {dupIds.has(p.id) && (
                        <span className="text-amber-700 mr-1" title="Looks like a duplicate">
                          ⚠
                        </span>
                      )}
                      {p.title}
                    </span>
                    <UrgencyBadge urgency={p.urgency} />
                  </li>
                ))}
              </ul>

              {duplicates.length > 0 && (
                <p className="text-xs text-amber-800 mt-2">
                  These look like the same work described twice — consider merging before
                  dispatching.
                </p>
              )}

              <div className="mt-2.5 pt-2.5 border-t border-line">
                <p className="text-xs text-ink-3">
                  <span className="font-medium text-ink-2">If deferred:</span>{" "}
                  {consequenceLine(issue)}
                </p>
                <p className="text-xs text-ink-2 mt-1.5">
                  <span className="font-medium">Bundle → {issue.bundle.title}.</span>{" "}
                  {issue.bundle.resolution}
                </p>
                {onBundle &&
                  (allRaised ? (
                    <Link
                      to="/work-orders"
                      className="inline-block mt-2.5 text-xs font-medium text-brand-600 hover:text-brand-800"
                    >
                      Work order raised — track it on the board ›
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBundle(issue, unlinked)}
                      className="mt-2.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5"
                    >
                      Bundle {unlinked.length} into one work order →
                    </button>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
