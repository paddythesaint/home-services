// Founder-only production self-check. Rules are published by hand in the
// Firebase console and can silently drift from the repo's firestore.rules —
// a green deploy doesn't prove the app works. These probes exercise the
// live permissions (read-only, a handful of tiny reads) and say exactly
// what's broken and how to fix it.

import { useState } from "react"
import { runDiagnostics } from "./firestoreApi"
import { Card, Button } from "./components"

function Dot({ ok }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
      style={{ background: ok ? "var(--color-status-good)" : "var(--color-status-critical)" }}
      aria-hidden="true"
    />
  )
}

export default function SystemStatus({ user }) {
  const [state, setState] = useState({ status: "idle", results: [] })

  async function run() {
    setState({ status: "running", results: [] })
    try {
      const results = await runDiagnostics(user)
      setState({ status: "done", results })
    } catch (err) {
      setState({
        status: "done",
        results: [
          {
            key: "fatal",
            label: "Diagnostics",
            ok: false,
            detail: err.code || String(err),
            fix: "Checks themselves failed to run — check the browser console and your connection.",
          },
        ],
      })
    }
  }

  const failed = state.results.filter((r) => !r.ok)

  return (
    <Card title="System status">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-ink-2">
          Probes the live Firestore permissions this app depends on. Rules are published
          manually in the Firebase console, so what's deployed can drift from what the code
          expects — this tells you if it has.
        </p>
        <Button variant="subtle" onClick={run} disabled={state.status === "running"}>
          {state.status === "running" ? "Checking…" : state.status === "done" ? "Re-run checks" : "Run checks"}
        </Button>
      </div>

      {state.status === "done" && (
        <>
          <p
            className={`text-sm font-medium mt-3 ${failed.length === 0 ? "text-ink" : "text-red-700"}`}
          >
            {failed.length === 0
              ? `All ${state.results.length} checks passed — production permissions match the app.`
              : `${failed.length} of ${state.results.length} checks failed.`}
          </p>
          <ul className="mt-2 divide-y divide-line">
            {state.results.map((r) => (
              <li key={r.key} className="py-2 flex items-start gap-2.5">
                <Dot ok={r.ok} />
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {r.label}
                    <span className="text-ink-3"> · {r.detail}</span>
                  </p>
                  {!r.ok && r.fix && <p className="text-xs text-red-700 mt-0.5">{r.fix}</p>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-ink-3 mt-3">
        All checks are read-only. Property <em>creation</em> can't be probed without writing
        data — if the create-property flow fails with a permission error, that rule isn't
        published yet (see RUNBOOK.md).
      </p>
    </Card>
  )
}
