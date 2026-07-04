// Shared between the Contractor Network table and the per-contractor
// profile page: the edit-form fields and the cross-property job feed.

export const contractorFields = [
  { name: "name", label: "Name", type: "text" },
  { name: "trades", label: "Trades", type: "text", placeholder: "e.g. HVAC, Roofing" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "website", label: "Website", type: "text" },
  {
    name: "cadence",
    label: "Service cadence",
    type: "text",
    placeholder: "e.g. Bi-monthly, Annual (June)",
  },
  { name: "sourcing", label: "How sourced", type: "text" },
  { name: "notes", label: "Notes", type: "textarea" },
]
