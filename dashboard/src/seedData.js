// Starter profile for 895 Old Ballard Road, assembled from public sources:
// Albemarle County assessor/MLS aggregators (year built, acreage, beds/baths,
// forced-air heat + central AC), EPA radon zone maps (Albemarle = Zone 1),
// and USDA hardiness zone 7a climate timing for the care calendar.
// Items that are inferred rather than confirmed say so in their notes —
// verify each during a walkthrough and edit freely.

export const seedProfile = {
  acreage: 5.011,
  yearBuilt: 1992,
}

export const seedHealthReport = [
  {
    category: "Heating & Cooling",
    detail: "Forced-air heating + central AC (per public records)",
    condition: "good",
    note: "Unit ages, brands, and fuel source (likely propane or heat pump — no gas main on Old Ballard Rd) not yet verified. Check nameplates and last service date.",
  },
  {
    category: "Private Well",
    detail: "Well water assumed — no public water service in this area",
    condition: "good",
    note: "VDH holds the well completion report (depth, yield, install date). Schedule an annual water test to baseline quality.",
  },
  {
    category: "Septic System",
    detail: "Septic assumed — no public sewer in this area",
    condition: "attention",
    note: "Tank location, size, and last pumping date unknown. VDH permit records can confirm. Standard cycle is every 3–5 years — establish the history.",
  },
  {
    category: "Water Heater",
    detail: "Type and age not in public records",
    condition: "good",
    note: "Check the nameplate for install year. If original-era or 12+ years old, plan replacement proactively.",
  },
  {
    category: "Electrical Panel",
    detail: "Presumed 1992-original panel",
    condition: "good",
    note: "Verify brand, capacity, and condition. 1990s panels are generally fine, but confirm no recalled brands and adequate capacity for the home.",
  },
  {
    category: "Roof",
    detail: "Material and age not confirmed",
    condition: "attention",
    note: "House built 1992 — if the roof has never been replaced it is past typical shingle life. Old MLS listing photos (MLS #609624) or county permits may date a replacement.",
  },
  {
    category: "Basement & Radon",
    detail: "Albemarle County is EPA radon Zone 1 (highest potential)",
    condition: "attention",
    note: "A radon test is recommended for any 1990s house with below-grade space in this county. Winter (closed-house) testing gives the most reliable reading.",
  },
  {
    category: "Exterior & Grounds",
    detail: "5.011 acres (county records)",
    condition: "good",
    note: "Document decks, fencing, drainage, and tree canopy near the roofline during a walkthrough — canopy over gutters drives cleaning frequency.",
  },
]

// Hardiness zone 7a timing: last frost ~mid-April, first frost ~late October.
export const seedCareCalendar = [
  { month: "January", task: "HVAC filter change" },
  { month: "January", task: "Check well head and exposed pipes for freeze protection" },
  { month: "February", task: "Prune trees and shrubs while dormant" },
  { month: "March", task: "HVAC spring service (cooling season prep)" },
  { month: "March", task: "Exterior walkthrough — check roof, siding, gutters after winter" },
  { month: "April", task: "Lawn program begins — mulching and bed maintenance" },
  { month: "April", task: "Irrigation startup (if system present)" },
  { month: "May", task: "Deck and exterior wood inspection; stain or seal as needed" },
  { month: "June", task: "HVAC filter change" },
  { month: "June", task: "Annual well water test" },
  { month: "July", task: "Pressure wash exterior surfaces" },
  { month: "August", task: "Septic system check — confirm pumping schedule" },
  { month: "September", task: "Lawn aeration and overseeding (ideal 7a window)" },
  { month: "September", task: "HVAC fall service (heating season prep)" },
  { month: "October", task: "Irrigation shutdown before first frost (~late October)" },
  { month: "October", task: "Chimney and fireplace inspection before burn season" },
  { month: "November", task: "Gutter cleaning after leaf drop" },
  { month: "November", task: "Winterize exterior faucets" },
  { month: "December", task: "HVAC filter change" },
  { month: "December", task: "Radon test — closed-house winter conditions are most accurate" },
]

export const seedPriorityList = [
  {
    title: "Radon test",
    category: "Health & Safety",
    reason: "Albemarle County is EPA radon Zone 1 and the house is 1990s construction. Cheap to rule out, important if elevated.",
    estCost: "$15 – $150",
    urgency: "high",
  },
  {
    title: "Locate septic tank and establish pumping history",
    category: "Systems",
    reason: "No pumping record on file. VDH permit records can locate the tank; standard cycle is 3–5 years.",
    estCost: "$0 records / $400 – $600 if pumping due",
    urgency: "high",
  },
  {
    title: "Annual well water test",
    category: "Water",
    reason: "Baseline test for bacteria, nitrates, and minerals — recommended yearly for private wells.",
    estCost: "$60 – $150",
    urgency: "medium",
  },
  {
    title: "HVAC service and system age documentation",
    category: "HVAC",
    reason: "Record unit ages, models, and fuel source during a routine service visit — seeds accurate replacement planning.",
    estCost: "$150 – $300",
    urgency: "medium",
  },
  {
    title: "Verify roof age",
    category: "Exterior",
    reason: "If original to 1992 it is beyond typical shingle life. Check old listing photos and county permits before paying for an inspection.",
    estCost: "$0 records / $150 – $400 inspection",
    urgency: "medium",
  },
  {
    title: "Water heater age check",
    category: "Plumbing",
    reason: "Read the nameplate serial for install year. 12+ years old means planning a proactive replacement beats an emergency one.",
    estCost: "$0",
    urgency: "low",
  },
]
