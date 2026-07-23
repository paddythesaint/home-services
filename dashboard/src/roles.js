// Who sees what. Four viewing roles, matching the actual team:
//   founder       — business owners (Paddy, Mike): everything.
//   relationship  — the client-facing seat (Sally): property plane plus the
//                   intake tools (walkthrough, import), no business plane,
//                   no financial forecast.
//   technician    — the visit seat: the systems, the manifest, the jobs.
//                   No money, no member management, no business plane.
//   homeowner     — the member default: their home's record, clean and
//                   uncluttered. Internal tools (walkthrough, import) and
//                   the business plane stay out of their way.
//
// Phase 1 is presentation, not security: business-plane pages are already
// rules-enforced (founders allowlist in firestore.rules); property-plane
// hiding is view tailoring for people who are legitimately members.
// Phase 2 (staff access without co-ownership) is the technician-share
// rules work in the backlog.

import { FOUNDER_EMAILS } from "./founders"

// Business staff by email. Add real teammates here as they join —
// unlisted members simply get the homeowner view, which is the safe
// default. The demo/test personas are harmless in production (nobody
// signs in with @example.com).
export const STAFF_ROLES = {
  ...Object.fromEntries(FOUNDER_EMAILS.map((e) => [e, "founder"])),
  "sallyrryan@gmail.com": "relationship", // Sally — real login
  "sally@example.com": "relationship", // demo/test persona (unroutable, harmless)
  "tech@example.com": "technician",
}

export const businessRole = (email) => STAFF_ROLES[(email || "").toLowerCase()] || null

// Nav item keys per role (keys match Layout's item list). The nav is
// intent-shaped, not table-shaped: two hubs (record, plan) hold the
// detail pages as tabs, and the intake tools live under Tools for the
// seats that use them.
const NAV = {
  founder: ["overview", "assistant", "record", "plan", "walkthrough", "import", "systemMap", "conversations"],
  relationship: ["overview", "assistant", "record", "plan", "walkthrough", "import", "systemMap", "conversations"],
  technician: ["overview", "assistant", "record", "plan", "walkthrough"],
  homeowner: ["overview", "assistant", "record", "plan"],
}

// Tabs inside the two hubs, per role — the old page-level trims live on
// here (technicians see no vendors, staff see no money).
const RECORD_TABS = {
  founder: ["health", "history", "coverage", "contractors"],
  relationship: ["health", "history", "coverage", "contractors"],
  technician: ["health", "history", "coverage"],
  homeowner: ["health", "history", "coverage", "contractors"],
}
const PLAN_TABS = {
  founder: ["next", "calendar", "priorities", "forecast", "report"],
  relationship: ["next", "calendar", "priorities", "report"],
  technician: ["next", "calendar", "priorities"],
  homeowner: ["next", "calendar", "priorities", "forecast", "report"],
}

// --- "View as" preview (founders only) ---
// Founders can borrow any other role's lens to sanity-check what a
// homeowner, Sally, or a technician actually sees — without signing in
// as them. The choice persists (localStorage) across pages and property
// switches until changed. Presentation only: it never grants anything,
// it only hides, and it has no effect for non-founders.

const VIEW_AS_KEY = "viewAsRole"

export const ROLE_LABELS = {
  founder: "Founder — full view",
  relationship: "Relationship (intake)",
  technician: "Technician (visit)",
  homeowner: "Homeowner",
}

export function getViewAs() {
  try {
    const v = localStorage.getItem(VIEW_AS_KEY)
    return v && NAV[v] ? v : "founder"
  } catch {
    return "founder"
  }
}

export function setViewAs(role) {
  try {
    if (!role || role === "founder") localStorage.removeItem(VIEW_AS_KEY)
    else if (NAV[role]) localStorage.setItem(VIEW_AS_KEY, role)
  } catch {
    /* private mode etc. — preview just won't persist */
  }
}

export function viewFor(email) {
  const actualRole = businessRole(email) || "homeowner"
  const role = actualRole === "founder" ? getViewAs() : actualRole
  return {
    role,
    actualRole,
    preview: actualRole === "founder" && role !== "founder",
    navKeys: new Set(NAV[role]),
    recordTabs: new Set(RECORD_TABS[role]),
    planTabs: new Set(PLAN_TABS[role]),
    business: role === "founder", // Business nav section + its pages
    staff: role !== "homeowner", // internal instruments (onboarding checklist)
    showBilling: role === "founder" || role === "homeowner",
  }
}
