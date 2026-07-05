// The business/platform plane: founders run the service and see
// cross-property business data (the contractor network, and eventually
// client health + internal notes). Property members — even full co-owners
// like Sally — are the homeowner plane and never see it.
//
// This list is UI gating only; the real enforcement is the matching
// allowlist in firestore.rules (isFounder). Keep the two in sync — adding
// a founder means editing both and publishing the rules.
export const FOUNDER_EMAILS = ["paddythesaint@gmail.com", "michael.e.sutton@gmail.com"]

export const isFounder = (email) => FOUNDER_EMAILS.includes((email || "").toLowerCase())
