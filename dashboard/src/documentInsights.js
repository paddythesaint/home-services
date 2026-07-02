// Facts extracted from the 2021 closing documents for 895 Old Ballard Rd
// (inspection contingency addendum, certified radon report, appraisal, deed,
// paint schedule, and a 2023 renovation estimate). Loan and mortgage details
// were deliberately excluded — only property-care data is captured here.

// Match is case-insensitive substring against existing system categories.
export const systemUpdates = [
  {
    match: "heating",
    data: {
      detail: "Propane (LP) forced-air furnace + central AC",
      brand: "",
      installYear: "2021 (furnace)",
      note: "Seller replaced the nonfunctioning furnace just before the March 2021 closing (HIRCA addendum), so the furnace is ~2021. AC age unverified. Fuel is propane — tank on site, propane credited at closing.",
    },
  },
  {
    match: "well",
    data: {
      detail: "Private well — confirmed by Jan 2021 appraisal",
      note: "Appraisal notes 'Well/Typical'. VDH holds the completion report (depth, yield, install date). Schedule an annual water test to baseline quality.",
    },
  },
  {
    match: "septic",
    data: {
      detail: "Septic system — confirmed by Jan 2021 appraisal",
      note: "Appraisal notes 'Septic/Typical'. Tank location and last pumping date still unknown — no pumping record in the closing documents. Standard cycle is 3–5 years.",
    },
  },
  {
    match: "roof",
    data: {
      detail: "Asphalt shingle, appraised 'average' condition Jan 2021",
      note: "No replacement permit or receipt in the closing documents — if original to 1992 it is past typical shingle life. Worth a professional look.",
    },
  },
  {
    match: "radon",
    data: {
      detail: "Radon mitigation system present; last test above action level",
      condition: "urgent",
      note: "Dec 2020 certified test (Clatterbuck Home Inspections): basement average 5.7 pCi/L — above the EPA 4.0 action level despite an existing mitigation system. The seller credited cash in lieu of repairing the system, so it was likely never serviced. Retest now; service or upgrade the mitigation system if still elevated.",
    },
  },
  {
    match: "exterior",
    data: {
      detail: "Brick colonial on 5.01 acres; asphalt drive, aluminum gutters",
      note: "From the Jan 2021 appraisal. FEMA Zone X (minimal flood risk). Egress easement shared with 891 Old Ballard Rd. Document decks, fencing, and tree canopy near the roofline during a walkthrough.",
    },
  },
]

// Added only if no existing system category contains the first word.
export const systemAdds = [
  {
    category: "Fireplaces & Gas Logs",
    detail: "Two gas-log fireplaces (propane)",
    condition: "attention",
    note: "Both sets of gas logs were flagged for service in the Feb 2021 inspection; the seller credited cash in lieu of repairs, so they may never have been serviced. Schedule a gas-log service and safety check.",
  },
  {
    category: "Propane Tank",
    detail: "On-site LP tank — feeds furnace, range, and gas logs",
    condition: "good",
    note: "Tank noted at closing (propane balance credited). Ownership (owned vs. supplier-leased) unknown — confirm with the propane supplier and record the service contract.",
  },
  {
    category: "Basement Kitchen",
    detail: "Second kitchen with stove in basement",
    condition: "attention",
    note: "Basement stove was flagged in the Feb 2021 inspection and repairs were credited rather than completed. Verify it works safely or decommission it.",
  },
  {
    category: "Kitchen & Appliances",
    detail: "Full kitchen/pantry renovation ~2023 (Young & Rannigan)",
    condition: "good",
    installYear: "2023",
    note: "Per estimate #347-83EDT: custom cabinetry (Russ' Fine Woods), new Pella kitchen window, relocated laundry to garage, new propane range line, microwave and warming drawers, wine fridge. Young & Rannigan: (434) 466-6058.",
  },
  {
    category: "Paint & Finishes",
    detail: "Room-by-room schedule on file (3/25/2021)",
    condition: "good",
    note: "Walls/trim/ceilings mostly Benjamin Moore White Dove OC-17; bedrooms, baths, and dining in Sherwin Williams Light French Gray SW-0055; office in BM Coventry Grey HC-169; stair handrail black high-gloss. Use for touch-ups and repaints.",
  },
]

export const priorityUpdates = [
  {
    match: "radon",
    data: {
      title: "Radon retest + mitigation system service",
      urgency: "high",
      reason: "Dec 2020 test averaged 5.7 pCi/L in the basement — above the EPA 4.0 action level — despite an existing mitigation system the seller never repaired. Retest, then service the system if still elevated.",
      estCost: "$15 – $150 test / $300 – $800 service",
    },
  },
]

export const priorityAdds = [
  {
    title: "Service gas logs — both fireplaces",
    category: "Safety",
    reason: "Flagged in the Feb 2021 inspection; seller credited cash instead of repairing. No service record since.",
    estCost: "$150 – $300",
    urgency: "medium",
  },
  {
    title: "Confirm propane tank ownership & service contract",
    category: "Systems",
    reason: "Tank feeds furnace, range, and gas logs. Confirm owned vs. leased with the supplier and get on a delivery/service schedule.",
    estCost: "$0",
    urgency: "low",
  },
]

// Added only if no job with the same title exists.
export const jobAdds = [
  {
    date: "December 28, 2020",
    title: "Certified radon test",
    category: "Records",
    sub: "Clatterbuck Home Inspections",
    status: "completed",
    cost: "—",
    notes: "Basement average 5.7 pCi/L over 7 days — above the EPA 4.0 action level. Mitigation system present but flagged for repair.",
  },
  {
    date: "February 2021",
    title: "Furnace replacement",
    category: "HVAC",
    sub: "Seller-arranged (pre-closing)",
    status: "completed",
    cost: "—",
    notes: "Seller replaced the nonfunctioning furnace per the inspection addendum, plus a $15,000 credit in lieu of the remaining repairs.",
  },
  {
    date: "Spring 2021",
    title: "Interior painting (whole house)",
    category: "Interior",
    sub: "Per paint schedule 3/25/2021",
    status: "completed",
    cost: "—",
    notes: "Room-by-room colors documented under Paint & Finishes on the Health Report.",
  },
  {
    date: "2023",
    title: "Kitchen & pantry renovation",
    category: "Renovation",
    sub: "Young & Rannigan — (434) 466-6058",
    status: "completed",
    cost: "per estimate #347-83EDT",
    notes: "Custom cabinetry by Russ' Fine Woods, new kitchen window, laundry relocated to garage, new propane range line. 10–12 week project.",
  },
]

export const profileUpdates = {
  acreage: 5.01,
}
