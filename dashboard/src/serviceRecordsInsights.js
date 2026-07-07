// Fourth insights wave: the 2026 service-records sweep (all Gmail labels,
// 1/1/2026 onward, compiled 7/7/2026). Everything here was read from real
// vendor emails — receipts, service reports, and scheduling threads. Only
// NEW findings ride in this wave; jobs already on the record (generator
// 6/15, Dodson 6/19, roof claim) are deliberately absent so nothing dupes.

export const serviceRecordsInsights = {
  systemUpdates: [
    {
      match: "landscap",
      data: {
        note: "All grounds work is handled by Jimmie Mills Landscaping (jmillslandscaping@yahoo.com, 4763 Columbia Rd, Gordonsville VA 22942): bi-weekly mowing in season (~$100/mow), spring cleanup + mulch (~$650), and aerate/overseed/fertilize as needed. Invoices arrive monthly by email.",
      },
    },
    {
      match: "hvac",
      data: {
        lastServiced: "June 12, 2026",
        note: "On Monticello Air's Air Care Club plan (2 maintenance visits/year, 10% discount, 3 units covered). ACC visit #2 of 2 completed June 12, 2026 — all units cleaned and serviced, R-410a refrigerant added ($285.21 after discount). Monticello Air: (434) 246-7111.",
      },
    },
  ],

  systemAdds: [
    {
      category: "Upstairs HVAC",
      detail: "Carrier split system — air handler in attic, condenser at back of home",
      brand: "Carrier",
      installYear: "2016",
      condition: "good",
      lastServiced: "June 12, 2026",
      location: "Air handler in attic",
      note: "Separate from the downstairs system. April 22, 2026: 'not cooling' call traced to a wire off the reversing valve (system ran heat when set to cool) — repaired, cooling verified; capacitor 40/5, Delta T 27, pressures good (Monticello Air invoice 36713303, $327.15). Covered by the ACC plan.",
    },
    {
      category: "Mini-Split HVAC",
      detail: "Third zone on the Monticello Air ACC plan",
      condition: "good",
      lastServiced: "June 12, 2026",
      note: "Serviced with the two split systems on ACC visit #2 (June 12, 2026): washable filters, coils, and drain cleaned. Brand/location not stated on the receipt — read the nameplate on the next visit.",
    },
    {
      category: "Ting Fire Safety Monitor",
      detail: "Ting by Whisker Labs — electrical fire monitoring, serial 48D496817",
      condition: "good",
      note: "Monitors the home's electrical network for fire-precursor faults; weekly reports arrive by email. Subscription renews ~June 14 ($49/year).",
    },
    {
      category: "Airthings Air Monitor",
      detail: "Continuous air-quality monitoring with weekly reports",
      condition: "good",
      note: "Weekly Airthings insight reports for 895 Old Ballard arrive by email — a live complement to the radon mitigation system's periodic checks.",
    },
  ],

  priorityUpdates: [
    {
      match: "roof",
      data: {
        reason: "Documentation formally requested from Franco Calabrese (Insured Roofs) on July 2, 2026 — invoice, scope, and workmanship warranty for the October 2025 full roof replacement. No reply yet; nudge if quiet by mid-July. (Note: Franco's email account was compromised in February — verify anything unusual by phone.)",
      },
    },
  ],

  priorityAdds: [
    {
      title: "Generator extended coverage lapsed — decide on protection plan",
      category: "Electrical",
      reason: "Generac's records show the standby generator's coverage expired 11/04/2023 — it has run uninsured for over two years. Generac has open extended-protection offers on file (invitation code G3N8TG2). Decide: extended plan, or self-insure with the annual Charlottesville Generators service.",
      estCost: "plan pricing in email",
      urgency: "medium",
    },
    {
      title: "Identify Fitch Services work — receipt and quote on file",
      category: "Records",
      reason: "Fitch Services (434-296-9980) sent an April 3 pricing quote (IMG_0003.pdf) and a June 15 paid receipt (IMG_0001.pdf), both via Sally — the PDFs name the scope but the emails don't. Attach both to the Assistant to extract the details into the record.",
      estCost: "$0 records",
      urgency: "low",
    },
  ],

  jobAdds: [
    {
      date: "February 20, 2026",
      title: "Pest control service (Q1)",
      category: "Pest Control",
      sub: "Dodson Pest Control",
      status: "completed",
      cost: "—",
      notes: "Service report attached to email (invoice sent separately).",
    },
    {
      date: "April 3, 2026",
      title: "Fitch Services estimate visit",
      category: "General",
      sub: "Fitch Services — (434) 296-9980",
      status: "completed",
      cost: "quote",
      notes: "Pricing quote received after an on-site visit (IMG_0003.pdf in email, via Nola Cirves). Scope in the PDF.",
    },
    {
      date: "Early April 2026",
      title: "Tree & shrub plant-health treatment (final of program)",
      category: "Landscaping",
      sub: "Bartlett Tree Experts — Michael Abbott, (434) 971-3020",
      status: "completed",
      cost: "—",
      notes: "Last treatment of the twig-blight/plant-health program, anticipated week of March 30 per arborist. Treatments judged effective; 2027 renewal proposal attached to the March 27 email.",
    },
    {
      date: "April 22, 2026",
      title: "Upstairs HVAC repair — not cooling",
      category: "HVAC",
      sub: "Monticello Air — (434) 246-7111",
      status: "completed",
      cost: "$327.15",
      notes: "System ran heat when set to cool: wire off the reversing valve repaired, short located and fixed; cooling verified. Carrier attic system (2016). Invoice 36713303 + 5 photos in email.",
    },
    {
      date: "April 24, 2026",
      title: "Pest control service (Q2)",
      category: "Pest Control",
      sub: "Dodson Pest Control",
      status: "completed",
      cost: "—",
      notes: "Service report attached to email (invoice sent separately).",
    },
    {
      date: "April 6, 2026",
      title: "Spring cleanup & mulch",
      category: "Landscaping",
      sub: "Jimmie Mills Landscaping",
      status: "completed",
      cost: "$650",
      notes: "Cleanup and mulch, invoiced April 14 with the March 31 mow ($750 total). Jimmie Mills, jmillslandscaping@yahoo.com, 4763 Columbia Rd, Gordonsville VA 22942 — handles all grounds work (~$100/mow, roughly bi-weekly in season, invoiced monthly).",
    },
    {
      date: "May 12, 2026",
      title: "Mowing (recurring grounds care)",
      category: "Landscaping",
      sub: "Jimmie Mills Landscaping",
      status: "completed",
      cost: "$100",
      notes: "Latest invoiced mow (June 4 invoice). Bi-weekly mowing runs through the season; invoices arrive monthly by email.",
    },
    {
      date: "June 12, 2026",
      title: "HVAC maintenance — ACC visit #2 of 2 + refrigerant",
      category: "HVAC",
      sub: "Monticello Air — (434) 246-7111",
      status: "completed",
      cost: "$285.21",
      notes: "All three units (two split systems + mini-split) cleaned and serviced under the Air Care Club plan; R-410a added ($316.90 less 10% ACC discount). Paid Visa x5185. Job 36712746.",
    },
    {
      date: "June 15, 2026",
      title: "Fitch Services — service call",
      category: "General",
      sub: "Fitch Services — (434) 296-9980",
      status: "completed",
      cost: "receipt on file",
      notes: "Receipt IMG_0001.pdf emailed same day (via Ashley Stogner, after Sally's call). Scope in the PDF — see the records priority to extract it.",
    },
  ],

  calendarAdds: [
    { month: "June", task: "Ting fire-monitor subscription renewal ($49/yr)" },
    { month: "June", task: "HVAC maintenance — ACC visit (Monticello Air)" },
  ],

  profileUpdates: {},
}
