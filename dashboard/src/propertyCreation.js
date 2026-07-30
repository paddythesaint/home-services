// Enter-once property creation (7/28): everything the new-home form knows
// lands in the right place at birth. The homeowner named on the form
// becomes the owner-member immediately — with their weekly-brief election
// honored and email intake routing their address from day one — and the
// creating founder is listed as founder, never as the home's owner.
// Shared by the real and mock firestoreApi so tests exercise the same doc.

import { businessRole } from "./roles"

export function buildNewProperty(data, user) {
  const email = (user.email || "").toLowerCase()
  const { ownerEmail: rawOwner, ownerBrief, ...profile } = data
  const ownerEmail = (rawOwner || "").trim().toLowerCase()

  const members = [
    { email, name: user.displayName || "", role: businessRole(email) || "owner" },
  ]
  const memberEmails = [email]
  if (ownerEmail && ownerEmail !== email && ownerEmail.includes("@")) {
    members.push({ email: ownerEmail, name: profile.clientName || "", role: "owner" })
    memberEmails.push(ownerEmail)
  }

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
  }
}
