// Mock data for the founding-member homeowner dashboard prototype.
// Modeled on the "Property Profile Session" deliverables described in the
// Charlottesville Home & Property Services business plan.

export const client = {
  name: "Whitfields",
  memberSince: "May 2026",
  tier: "Founding Member",
  monthlyRate: 129,
  rateLocked: true,
  nextInvoiceDate: "August 1, 2026",
  referralCredits: 1,
}

export const property = {
  address: "2847 Turkey Sag Road",
  areaLabel: "Keswick, VA",
  acreage: 4.2,
  yearBuilt: 1998,
  profileSessionDate: "May 14, 2026",
  conductedBy: "Founding Team",
}

export const healthReport = {
  generatedOn: "May 15, 2026",
  systems: [
    {
      category: "HVAC",
      detail: "Two Trane XR16 units (2016, 2019)",
      condition: "good",
      note: "Filters last changed March 2026. South unit due for spring service.",
    },
    {
      category: "Water Heater",
      detail: "Rheem 50-gal gas, installed 2018",
      condition: "good",
      note: "No known issues. Anode rod inspection recommended within 12 months.",
    },
    {
      category: "Electrical Panel",
      detail: "200A service, Square D panel (2005)",
      condition: "attention",
      note: "Two breakers show minor corrosion — flagged for electrician review.",
    },
    {
      category: "Irrigation",
      detail: "9-zone Rain Bird system",
      condition: "good",
      note: "Startup pending for the season. Zone 4 head reported slow to close.",
    },
    {
      category: "Well & Septic",
      detail: "Private well, septic tank pumped 2023",
      condition: "attention",
      note: "Septic due for pumping within 12 months per standard 3-year cycle.",
    },
    {
      category: "Generator",
      detail: "Generac 22kW automatic standby (2020)",
      condition: "good",
      note: "Under manufacturer warranty through 2027. Annual service current.",
    },
    {
      category: "Exterior / Deck",
      detail: "Pressure-treated deck, ~450 sq ft (2012)",
      condition: "attention",
      note: "Staining faded on south-facing boards. Owner flagged as a priority.",
    },
    {
      category: "Roof & Gutters",
      detail: "Architectural shingle, 2014",
      condition: "good",
      note: "Last cleaned November 2025. No visible damage at walkthrough.",
    },
  ],
}

export const careCalendar = [
  { month: "January", tasks: ["HVAC filter change", "Generator monthly self-test check"] },
  { month: "February", tasks: ["Gutter inspection (pre-spring)", "Well water test"] },
  { month: "March", tasks: ["HVAC spring service", "Exterior inspection walkthrough"] },
  { month: "April", tasks: ["Irrigation startup", "Mulching & bed maintenance"] },
  { month: "May", tasks: ["Deck staining (as needed, 2-yr cycle)", "Lawn program begins"] },
  { month: "June", tasks: ["HVAC filter change", "Irrigation zone check"] },
  { month: "July", tasks: ["Pressure washing (exterior)", "Lawn program"] },
  { month: "August", tasks: ["HVAC filter change", "Septic service (if due)"] },
  { month: "September", tasks: ["Lawn program", "Fence inspection"] },
  { month: "October", tasks: ["Irrigation shutdown", "Leaf removal begins"] },
  { month: "November", tasks: ["Gutter cleaning", "Generator winter service"] },
  { month: "December", tasks: ["HVAC filter change", "Holiday-season exterior check"] },
]

export const priorityList = [
  {
    rank: 1,
    title: "Electrical panel breaker inspection",
    category: "Electrical",
    reason: "Corrosion flagged during Property Profile session — safety priority.",
    estCost: "$150 – $350",
    urgency: "high",
  },
  {
    rank: 2,
    title: "Deck staining & board repair",
    category: "Exterior",
    reason: "Faded south-facing boards; owner-flagged during walkthrough.",
    estCost: "$800 – $1,400",
    urgency: "medium",
  },
  {
    rank: 3,
    title: "Irrigation startup + Zone 4 repair",
    category: "Landscaping",
    reason: "Seasonal startup due; slow-closing head needs adjustment.",
    estCost: "$200 – $400",
    urgency: "medium",
  },
  {
    rank: 4,
    title: "Septic pumping",
    category: "Systems",
    reason: "Due within 12 months on standard 3-year cycle.",
    estCost: "$400 – $600",
    urgency: "low",
  },
  {
    rank: 5,
    title: "Water heater anode rod inspection",
    category: "Plumbing",
    reason: "Preventive check recommended within 12 months.",
    estCost: "$150 – $250",
    urgency: "low",
  },
]

export const jobHistory = [
  {
    date: "June 24, 2026",
    title: "Lawn maintenance visit",
    category: "Landscaping",
    sub: "Blue Ridge Grounds Co.",
    status: "completed",
    cost: "$225",
    notes: "Mowing, edging, bed cleanup. No issues reported.",
  },
  {
    date: "June 10, 2026",
    title: "Lawn maintenance visit",
    category: "Landscaping",
    sub: "Blue Ridge Grounds Co.",
    status: "completed",
    cost: "$225",
    notes: "Regular visit, on schedule.",
  },
  {
    date: "May 28, 2026",
    title: "Irrigation startup",
    category: "Landscaping",
    sub: "Piedmont Irrigation",
    status: "completed",
    cost: "$310",
    notes: "System started; Zone 4 head noted for follow-up repair.",
  },
  {
    date: "May 14, 2026",
    title: "Property Profile Session",
    category: "Onboarding",
    sub: "Founding Team",
    status: "completed",
    cost: "included",
    notes: "Full systems walkthrough. Generated Property Health Report.",
  },
  {
    date: "July 8, 2026",
    title: "Electrical panel inspection",
    category: "Electrical",
    sub: "TBD — pending assignment",
    status: "scheduled",
    cost: "est. $150 – $350",
    notes: "Dispatched from 90-Day Priority List item #1.",
  },
]
