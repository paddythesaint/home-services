// Getting a new property to a rich record, step by step. Rendered on the
// Overview of any non-seed property until every required step is done —
// this is the "how does home #2, #3, #20 get onboarded" answer, visible in
// the product itself. Done-states derive from the record; nothing is
// hand-ticked.

import { Link } from "react-router-dom"
import { Card } from "./components"

export function onboardingSteps({ profile, systems, jobs }) {
  return [
    {
      key: "walkthrough",
      label: "Walk the property",
      detail:
        "Confirm the basics and every system in person — capture nameplate photos as you go.",
      to: "/walkthrough",
      done: !!profile.walkthroughCompletedOn,
    },
    {
      key: "systems",
      label: "Build the system list",
      detail:
        "Every major system gets a Health Report card. The walkthrough adds them, or add by hand.",
      to: "/health-report",
      done: systems.length > 0,
    },
    {
      key: "bundle",
      label: "Load a prepared bundle",
      detail:
        "If a photo-and-facts bundle was prepared for this home, one click applies all of it.",
      to: "/import",
      done: !!profile.bundleImportedOn,
      optional: true,
    },
    {
      key: "jobs",
      label: "Log the service history",
      detail:
        "Past and scheduled work — even a few jobs makes the record (and the demo) feel alive.",
      to: "/job-history",
      done: jobs.length > 0,
    },
    {
      key: "invite",
      label: "Invite the homeowner",
      detail:
        'Add them by Google email in "People with access" below — they see everything, live.',
      done: (profile.members || []).length > 1,
    },
  ]
}

function StepIcon({ done }) {
  return done ? (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white"
      style={{ background: "var(--color-status-good)" }}
      aria-label="Done"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span
      className="w-5 h-5 rounded-full border-2 border-line shrink-0"
      aria-label="Not done yet"
    />
  )
}

export default function OnboardingChecklist({ profile, systems, jobs }) {
  const steps = onboardingSteps({ profile, systems, jobs })
  const required = steps.filter((s) => !s.optional)
  if (required.every((s) => s.done)) return null

  const doneCount = steps.filter((s) => s.done).length

  return (
    <div className="mb-6">
      <Card title="Getting this home ready">
        <p className="text-sm text-ink-2 -mt-1">
          {doneCount} of {steps.length} steps done. Each one is derived from the record —
          finish them and this card retires itself.
        </p>
        <ul className="mt-3 divide-y divide-line">
          {steps.map((s) => (
            <li key={s.key} className="py-2.5 flex items-start gap-3">
              <StepIcon done={s.done} />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${s.done ? "text-ink-3 line-through" : "text-ink"}`}>
                  {s.label}
                  {s.optional && !s.done && (
                    <span className="ml-2 text-xs font-normal text-ink-3">optional</span>
                  )}
                </p>
                {!s.done && <p className="text-xs text-ink-3 mt-0.5">{s.detail}</p>}
              </div>
              {!s.done && s.to && (
                <Link
                  to={s.to}
                  className="ml-auto shrink-0 text-sm font-medium text-brand-600 hover:text-brand-800"
                >
                  Go &rarr;
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
