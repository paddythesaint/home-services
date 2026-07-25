// The designated pro per trade — the founder's standing answer to "who do
// we call for this?", named 7/25. This is the simple form of the Wave-2
// vendor-designation item: data first, receipts later. The homeowner
// surface counts these as "trusted pros on call"; the quote machinery can
// prefer them when suggesting contractors.

export const DESIGNATED_PROS = [
  { trade: "HVAC", name: "Monticello Air" },
  { trade: "Plumbing", name: "Sunwave Plumbing" },
  // No proven electrician yet — Fitch Services is the interim default
  // until someone earns the seat.
  { trade: "Electrical", name: "Fitch Services", interim: true },
]

export const designatedFor = (trade) =>
  DESIGNATED_PROS.find((d) => d.trade.toLowerCase() === (trade || "").toLowerCase()) || null
