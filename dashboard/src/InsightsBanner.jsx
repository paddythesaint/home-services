import { useState } from "react"
import { Button } from "./components"
import { logFact, fieldLabel } from "./facts"

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// One-time enrichment wave from a reviewed document set. Updates matching
// systems/priorities in place, adds what's missing, backfills job history and
// calendar tasks — then stamps `flagField` on the profile so this wave's
// banner never returns. Multiple waves coexist, each with its own flag.
export default function InsightsBanner({
  title,
  description,
  buttonLabel,
  flagField,
  insights,
  healthApi,
  priorityApi,
  jobApi,
  calendarApi,
  saveProfile,
  uid,
}) {
  const [state, setState] = useState("idle")
  const {
    systemUpdates = [],
    systemAdds = [],
    priorityUpdates = [],
    priorityAdds = [],
    jobAdds = [],
    calendarAdds = [],
    profileUpdates = {},
  } = insights

  async function apply() {
    setState("working")
    try {
      for (const { match, data } of systemUpdates) {
        const target = healthApi.items.find((i) =>
          i.category.toLowerCase().includes(match)
        )
        if (target) {
          await healthApi.update(target.id, data)
          const changed = Object.keys(data).filter((k) => k !== "verified" && k !== "verifiedOn")
          if (changed.length > 0) {
            await logFact(uid, target.id, `Set ${changed.map(fieldLabel).join(", ")}`, {
              type: "insights",
              label: title,
            })
          }
        }
      }
      for (const item of systemAdds) {
        const firstWord = item.category.split(" ")[0].toLowerCase()
        const exists = healthApi.items.some((i) =>
          i.category.toLowerCase().includes(firstWord)
        )
        if (!exists) await healthApi.add(item)
      }
      for (const { match, data } of priorityUpdates) {
        const target = priorityApi.items.find((i) =>
          i.title.toLowerCase().includes(match)
        )
        if (target) await priorityApi.update(target.id, data)
      }
      for (const item of priorityAdds) {
        const exists = priorityApi.items.some(
          (i) => i.title.toLowerCase() === item.title.toLowerCase()
        )
        if (!exists) await priorityApi.add(item)
      }
      for (const job of jobAdds) {
        const exists = jobApi.items.some(
          (j) => j.title.toLowerCase() === job.title.toLowerCase()
        )
        if (!exists) await jobApi.add(job)
      }
      if (calendarApi) {
        for (const task of calendarAdds) {
          const exists = calendarApi.items.some(
            (t) =>
              t.month === task.month &&
              t.task.toLowerCase() === task.task.toLowerCase()
          )
          if (!exists) await calendarApi.add(task)
        }
      }
      await saveProfile({ ...profileUpdates, [flagField]: todayLabel() })
    } catch (e) {
      console.error(e)
      setState("error")
    }
  }

  return (
    <div className="bg-brand-100 border border-line rounded-xl p-5 mb-4">
      <p className="font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-2 mt-1">{description}</p>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={apply} disabled={state === "working"}>
          {state === "working" ? "Applying…" : buttonLabel}
        </Button>
      </div>
      {state === "error" && (
        <p className="text-sm text-red-600 mt-2">
          Something went wrong writing to the database — try again.
        </p>
      )}
    </div>
  )
}
