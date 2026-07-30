// The designated pro per trade — a home's standing answer to "who do we
// call for this?", named 7/25. Designations are per home (7/30): the
// flagship's proven vendors belong to 895 alone, and every other home
// starts empty until its owner names their own pros
// (profile.designatedPros: [{ trade, name, interim? }]).

import { seedAddressHint } from "./seedData"

// 895's earned list — applies only to the flagship, never as a default.
const FLAGSHIP_PROS = [
  { trade: "HVAC", name: "Monticello Air" },
  { trade: "Plumbing", name: "Sunwave Plumbing" },
  // No proven electrician yet — Fitch Services is the interim default
  // until someone earns the seat.
  { trade: "Electrical", name: "Fitch Services", interim: true },
]

export const designationsFor = (profile) => {
  if (Array.isArray(profile?.designatedPros) && profile.designatedPros.length > 0)
    return profile.designatedPros
  return seedAddressHint.test(profile?.address || "") ? FLAGSHIP_PROS : []
}

export const designatedFor = (profile, trade) =>
  designationsFor(profile).find(
    (d) => d.trade.toLowerCase() === (trade || "").toLowerCase()
  ) || null
