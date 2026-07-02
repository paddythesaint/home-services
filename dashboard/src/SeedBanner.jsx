import { useState } from "react"
import { saveProperty, seedCollections } from "./firestoreApi"
import {
  seedProfile,
  seedHealthReport,
  seedCareCalendar,
  seedPriorityList,
} from "./seedData"
import { Button } from "./components"

export default function SeedBanner({ uid }) {
  const [state, setState] = useState("idle") // idle | working | error

  async function loadStarterProfile() {
    setState("working")
    try {
      await saveProperty(uid, seedProfile)
      await seedCollections(uid, {
        healthReport: seedHealthReport,
        careCalendar: seedCareCalendar,
        priorityList: seedPriorityList,
      })
      // No state reset needed — the live Firestore subscriptions repopulate
      // the pages, and this banner unmounts once items exist.
    } catch (e) {
      console.error(e)
      setState("error")
    }
  }

  return (
    <div className="bg-brand-100 border border-line rounded-lg p-5 mb-6">
      <p className="font-semibold text-ink">Start with a pre-filled profile?</p>
      <p className="text-sm text-ink-2 mt-1">
        We assembled a starter dataset for this property from public records —
        county assessor data (built 1992, 5.011 acres, forced-air heat + central
        AC), EPA radon zone maps, and a zone 7a seasonal care calendar. Items we
        inferred rather than confirmed say so in their notes. Everything is
        editable or deletable afterward.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={loadStarterProfile} disabled={state === "working"}>
          {state === "working" ? "Loading…" : "Load starter profile"}
        </Button>
        <span className="text-xs text-ink-2">
          or skip this and add everything by hand
        </span>
      </div>
      {state === "error" && (
        <p className="text-sm text-red-600 mt-2">
          Something went wrong writing to the database — try again, and check
          the browser console if it persists.
        </p>
      )}
    </div>
  )
}
