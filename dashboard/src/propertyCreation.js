// Enter-once property creation (7/28): everything the new-home form knows
// lands in the right place at birth. The homeowner named on the form
// becomes the owner-member immediately — with their weekly-brief election
// honored and email intake routing their address from day one.
//
// Respect doctrine (7/30): business staff (founder / relationship /
// technician) are NEVER members of a client's home. Their access is
// platform-side (firestore.rules isFounder/isStaff), so a home's
// "People with access" lists only the household. A staff creator is
// therefore left off the member list entirely; a diy pilot or homeowner
// creating their own home still becomes its owner. Requires the rules
// version that grants founders property access without membership.
// Shared by the real and mock firestoreApi so tests exercise the same doc.

import { businessRole } from "./roles"

const BUSINESS_SEATS = new Set(["founder", "relationship", "technician"])

export function buildNewProperty(data, user) {
  const email = (user.email || "").toLowerCase()
  const { ownerEmail: rawOwner, ownerBrief, ...profile } = data
  const ownerEmail = (rawOwner || "").trim().toLowerCase()

  const members = []
  const platform = businessRole(email)
  if (!BUSINESS_SEATS.has(platform)) {
    members.push({ email, name: user.displayName || "", role: platform || "owner" })
  }
  if (ownerEmail && ownerEmail !== email && ownerEmail.includes("@")) {
    members.push({ email: ownerEmail, name: profile.clientName || "", role: "owner" })
  }
  const memberEmails = members.map((m) => m.email)

  return {
    ...profile,
    members,
    memberEmails,
    ...(ownerEmail && ownerEmail !== email && ownerEmail.includes("@")
      ? { briefStyles: { [ownerEmail]: ownerBrief || "passive" } }
      : {}),
    // Starts the onboarding clock: the empty-record reminder measures
    // from here (functions/digest.js).
    createdOnMs: Date.now(),
    // Queues the background address researcher (functions/enrichment.js):
    // public-record basics and sourced facts file in within ~10 minutes.
    ...(profile.address ? { research: "requested" } : {}),
  }
}
