// Role-aware first-login tour scripts. Targets name [data-tour] anchors in
// Layout / HomeownerHome; a missing anchor (e.g. on mobile, where the
// sidebar is hidden) just renders that step as a centered card.

export function tourStepsFor(role) {
  if (role === "founder") {
    return [
      {
        title: "Welcome — the two-minute lay of the land",
        body: "Four quick stops. You can skip any time; replay from the sidebar whenever you like.",
      },
      {
        target: "property-nav",
        title: "The home's record",
        body: "Everything about the house lives here — its systems and their health, the care calendar, the 90-day plan, and every job ever done. This is what we keep current for every home.",
      },
      {
        target: "view-as",
        title: "See it as a client",
        body: "This switcher shows you exactly what a homeowner sees — a much calmer view. Flip it any time; the amber banner brings you back.",
      },
      {
        target: "business-nav",
        title: "The business side",
        body: "The operation across every home: live status per property, the work pipeline from request to done, and the vendor network. Clients never see this section.",
      },
      {
        title: "Start with your own home",
        body: "Head to your house's page — a short checklist walks you through building its record. Anything unclear, we're one call away.",
      },
    ]
  }
  if (role === "homeowner") {
    return [
      {
        title: "Your home, handled",
        body: "This is your home's page — what shape it's in, what's happening, and what's been done. We keep it current; you never have to.",
      },
      {
        target: "request",
        title: "Need anything? One tap.",
        body: "A repair, a question, something that doesn't look right — send it here and we take it from there. You'll always see where it stands.",
      },
      {
        target: "team",
        title: "Real people, not a portal",
        body: "Your team is right here — call, text, or email any time. The app is just how we keep you in the loop.",
      },
    ]
  }
  return [] // staff seats get no tour — they're trained in person
}
