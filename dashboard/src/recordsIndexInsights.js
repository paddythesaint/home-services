// Second insights wave, from the "Home Records Index" (compiled 7/2/2026 from
// Gmail + Drive): HVAC installer/warranty, standby generator, pest control,
// the 2025–26 roof insurance claim, and gaps worth chasing (current insurance
// policy, email-only documents). Financial/loan details excluded as before.

export const recordsIndexInsights = {
  systemUpdates: [
    {
      match: "heating",
      data: {
        installYear: "2021 (furnace)",
        lastServiced: "March 2022 (last documented)",
        note: "Furnace work completed and warranty registered March 2021 by Monticello Air (434-246-7111); plan included maintenance visits Sept 2021 and March 2022 — nothing documented since, so a service visit is likely overdue. Four Seasons Heating & Cooling did a furnace inspection Feb 2021 (invoice 1-3087429). Warranty PDF lives in email: search from:monticelloair.com.",
      },
    },
    {
      match: "roof",
      data: {
        condition: "attention",
        note: "2025–26 Allstate storm claim #000795661826: damage judged not storm-related/not covered, but ~$8k was routed to contractor Insured Roofs. Confirm exactly what work was completed, and get the invoice and any workmanship warranty into the record. Roof age still unestablished.",
      },
    },
  ],

  systemAdds: [
    {
      category: "Standby Generator",
      detail: "22kW standby generator, front of house",
      condition: "good",
      installYear: "2021",
      lastServiced: "June 15, 2026",
      note: "Installed ~May 2021 by Charlottesville Generators (434-326-4564) with a 5-year warranty (all parts/labor years 1–2) — warranty is now at/near expiry. Annual maintenance current: health report + invoice #445 on June 15, 2026. Service report PDF is in email: search from:cvillegen.com \"Generator Health Report\".",
    },
    {
      category: "Pest Control",
      detail: "Dodson Pest Control — recurring bi-monthly service",
      condition: "good",
      lastServiced: "June 19, 2026",
      note: "Reports on file every two months since Aug 2025 (latest 6/19/26). Report PDFs arrive by email (search from:dodsonbros.com has:attachment); invoices are sent separately.",
    },
  ],

  priorityUpdates: [
    {
      match: "roof",
      data: {
        title: "Confirm roof repair scope & warranty (Insured Roofs)",
        urgency: "medium",
        reason: "The 2025–26 Allstate claim was denied as non-storm damage, yet ~$8k went to Insured Roofs — confirm what was actually done, collect the invoice/warranty, and pin down roof age.",
        estCost: "$0 records",
      },
    },
  ],

  priorityAdds: [
    {
      title: "Get current homeowner's insurance policy on file",
      category: "Records",
      reason: "No current policy PDF for 895 Old Ballard was found in Drive or email. Download it from the insurer's portal and add it to the Home Services folder.",
      estCost: "$0",
      urgency: "medium",
    },
    {
      title: "Pull key documents out of email into Drive",
      category: "Records",
      reason: "Live only as Gmail attachments: Clatterbuck full inspection report (Dec 2020), Monticello Air HVAC warranty (Mar 2021), generator proposal + service reports (cvillegen.com), and Dodson pest reports. The records index lists the exact Gmail search for each.",
      estCost: "$0",
      urgency: "low",
    },
    {
      title: "Schedule HVAC service — none documented since March 2022",
      category: "HVAC",
      reason: "The Monticello Air plan's last documented visit was March 2022. Four years without documented service on a 2021 furnace is worth correcting before heating season.",
      estCost: "$150 – $300",
      urgency: "medium",
    },
  ],

  jobAdds: [
    {
      date: "February 18, 2021",
      title: "Furnace inspection & cleaning",
      category: "HVAC",
      sub: "Four Seasons Heating & Cooling",
      status: "completed",
      cost: "—",
      notes: "Invoice 1-3087429 (email only).",
    },
    {
      date: "March 12, 2021",
      title: "HVAC completed work + warranty registration",
      category: "HVAC",
      sub: "Monticello Air — (434) 246-7111",
      status: "completed",
      cost: "—",
      notes: "Warranty registered; install photos and quality inspection 3/18/21. Included maintenance visits 9/16/21 and 3/16/22.",
    },
    {
      date: "May 2021",
      title: "Standby generator installation (22kW)",
      category: "Electrical",
      sub: "Charlottesville Generators",
      status: "completed",
      cost: "—",
      notes: "Front-of-house placement; 5-year warranty, all parts/labor years 1–2.",
    },
    {
      date: "June 15, 2026",
      title: "Generator annual maintenance",
      category: "Electrical",
      sub: "Charlottesville Generators — (434) 326-4564",
      status: "completed",
      cost: "Invoice #445",
      notes: "Digital service report ('jobCard.pdf') with system health check, service photos, and findings — in email.",
    },
    {
      date: "June 19, 2026",
      title: "Pest control service (recurring)",
      category: "Pest Control",
      sub: "Dodson Pest Control",
      status: "completed",
      cost: "—",
      notes: "Latest of bi-monthly visits running since Aug 2025.",
    },
    {
      date: "2025–2026",
      title: "Roof storm claim & contractor payment",
      category: "Exterior",
      sub: "Allstate / Insured Roofs",
      status: "completed",
      cost: "~$8,000 (insurance-routed)",
      notes: "Claim #000795661826 denied as non-storm damage; check endorsed via U.S. Bank to Insured Roofs. Scope of completed work unconfirmed.",
    },
  ],

  calendarAdds: [
    { month: "June", task: "Generator annual service (Charlottesville Generators)" },
  ],

  profileUpdates: {},
}
