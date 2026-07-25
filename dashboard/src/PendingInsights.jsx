import { useItems } from "./useItems"
import InsightsBanner from "./InsightsBanner"
import { seedAddressHint } from "./seedData"
import { closingDocsInsights } from "./documentInsights"
import { recordsIndexInsights } from "./recordsIndexInsights"
import { energyAuditInsights } from "./energyAuditInsights"
import { serviceRecordsInsights } from "./serviceRecordsInsights"

// The one-time document-insight applications (closing docs, records index,
// energy audit, 2026 service records). These lived on the Home screen from
// their birth slices; the 7/24 UX cleanup moved them here to Import Records
// — they are operator instruments, not something the household should scroll
// past daily. Each disappears permanently once applied (profile flag).

const BANNERS = [
  {
    flagField: "insightsAppliedOn",
    title: "Apply insights from your closing documents?",
    buttonLabel: "Apply document insights",
    insights: closingDocsInsights,
    description:
      "We reviewed the 2021 closing package — inspection addendum, certified radon report, appraisal, paint schedule, and the 2023 kitchen renovation estimate. This updates your systems with what they revealed (furnace replaced 2021, propane fuel, radon at 5.7 pCi/L with an unserviced mitigation system, two gas-log fireplaces flagged for service), adds a paint-color reference, and backfills your job history. Everything stays editable; mortgage details were excluded.",
  },
  {
    flagField: "recordsIndexAppliedOn",
    title: "Apply insights from your Home Records Index?",
    buttonLabel: "Apply records-index insights",
    insights: recordsIndexInsights,
    description:
      "We reviewed the records index compiled from your Gmail and Drive. This adds your 22kW standby generator (installed 2021, serviced June 2026) and Dodson pest-control service, records the furnace's installer and warranty (Monticello Air, 2021), flags the 2025–26 roof insurance claim for follow-up, backfills six jobs, and adds priorities for the missing homeowner's-insurance policy and email-only documents worth saving.",
  },
  {
    flagField: "energyAuditAppliedOn",
    title: "Apply insights from your March 2026 energy audit?",
    buttonLabel: "Apply energy-audit insights",
    insights: energyAuditInsights,
    description:
      "We read the full 40-page LEAP energy audit (report #387364, March 10, 2026). Two safety findings lead: the water heaters failed the gas-leak screen (burner corrosion, loose exhaust gasket) and the auditor was blunt about the basement stove — 'fix it or get rid of it'. This also adds windows (mold in four rooms), ventilation (three bath fans at 0 CFM), attic insulation, and drainage as systems, logs the audit as a job, and queues the ~$687/yr weatherization package as a priority.",
  },
  {
    flagField: "serviceRecords2026AppliedOn",
    title: "Apply your 2026 service records from Gmail?",
    buttonLabel: "Apply service records",
    insights: serviceRecordsInsights,
    description:
      "We swept every label from January 1, 2026 onward. This adds nine service visits to your job history — Monticello Air's April upstairs-HVAC repair ($327.15, reversing-valve wire) and June maintenance visit ($285.21 with refrigerant), Dodson's February and April visits, Bartlett's spring tree treatment, Jimmie Mills' spring cleanup & mulch ($650) and latest mow, and two Fitch Services entries — plus four systems the record was missing (the upstairs Carrier system, the mini-split, and your Ting and Airthings monitors), the lapsed Generac coverage as a priority, and two calendar tasks. Amounts and contacts come straight from the receipts; nothing already on the record is duplicated.",
  },
]

export default function PendingInsights({ uid, profile, saveProfile }) {
  const healthApi = useItems(uid, "healthReport")
  const priorityApi = useItems(uid, "priorityList")
  const jobApi = useItems(uid, "jobHistory")
  const calendarApi = useItems(uid, "careCalendar")

  // These bundles were assembled from the original property's documents —
  // never offer them on another home.
  if (!seedAddressHint.test(profile?.address || "")) return null
  const pending = BANNERS.filter((b) => !profile?.[b.flagField])
  if (pending.length === 0) return null

  return (
    <>
      {pending.map((b) => (
        <InsightsBanner
          key={b.flagField}
          title={b.title}
          description={b.description}
          buttonLabel={b.buttonLabel}
          flagField={b.flagField}
          insights={b.insights}
          healthApi={healthApi}
          priorityApi={priorityApi}
          jobApi={jobApi}
          calendarApi={calendarApi}
          saveProfile={saveProfile}
          uid={uid}
        />
      ))}
    </>
  )
}
