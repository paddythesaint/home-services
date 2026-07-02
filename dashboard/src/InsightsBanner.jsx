import { useState } from "react"
import {
  systemUpdates,
  systemAdds,
  priorityUpdates,
  priorityAdds,
  jobAdds,
  profileUpdates,
} from "./documentInsights"
import { Button } from "./components"

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// One-time enrichment from the 2021 closing documents. Updates matching
// systems/priorities in place, adds what's missing, and backfills job
// history — then records insightsAppliedOn so the banner never returns.
export default function InsightsBanner({
  healthItems,
  priorityItems,
  jobItems,
  healthApi,
  priorityApi,
  jobApi,
  saveProfile,
}) {
  const [state, setState] = useState("idle")

  async function apply() {
    setState("working")
    try {
      for (const { match, data } of systemUpdates) {
        const target = healthItems.find((i) =>
          i.category.toLowerCase().includes(match)
        )
        if (target) await healthApi.update(target.id, data)
      }
      for (const item of systemAdds) {
        const firstWord = item.category.split(" ")[0].toLowerCase()
        const exists = healthItems.some((i) =>
          i.category.toLowerCase().includes(firstWord)
        )
        if (!exists) await healthApi.add(item)
      }
      for (const { match, data } of priorityUpdates) {
        const target = priorityItems.find((i) =>
          i.title.toLowerCase().includes(match)
        )
        if (target) await priorityApi.update(target.id, data)
      }
      for (const item of priorityAdds) {
        const exists = priorityItems.some(
          (i) => i.title.toLowerCase() === item.title.toLowerCase()
        )
        if (!exists) await priorityApi.add(item)
      }
      for (const job of jobAdds) {
        const exists = jobItems.some(
          (j) => j.title.toLowerCase() === job.title.toLowerCase()
        )
        if (!exists) await jobApi.add(job)
      }
      await saveProfile({ ...profileUpdates, insightsAppliedOn: todayLabel() })
    } catch (e) {
      console.error(e)
      setState("error")
    }
  }

  return (
    <div className="bg-brand-100 border border-line rounded-xl p-5 mb-4">
      <p className="font-semibold text-ink">
        Apply insights from your closing documents?
      </p>
      <p className="text-sm text-ink-2 mt-1">
        We reviewed the 2021 closing package — inspection addendum, certified
        radon report, appraisal, paint schedule, and the 2023 kitchen renovation
        estimate. This updates your systems with what they revealed (furnace
        replaced 2021, propane fuel, radon at 5.7 pCi/L with an unserviced
        mitigation system, two gas-log fireplaces flagged for service), adds a
        paint-color reference, and backfills your job history. Everything stays
        editable; mortgage details were excluded.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={apply} disabled={state === "working"}>
          {state === "working" ? "Applying…" : "Apply document insights"}
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
