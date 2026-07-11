import { describe, it, expect } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderPage } from "./renderPage"
import PriorityList from "../pages/PriorityList"
import {
  issueForPriority,
  detectIssues,
  findDuplicates,
  escalationCeiling,
  consequenceLine,
} from "../issuePlaybook"
import { addItem, __getItems } from "../mocks/firestoreApi"
import { waitFor } from "@testing-library/react"

describe("issue playbook (pure)", () => {
  it("maps priorities onto issues by their signatures", () => {
    expect(issueForPriority({ title: "Clean window mold + fix ventilation cause" }).key).toBe(
      "ventilation"
    )
    // Water-heater combustion venting is safety, not the ventilation bucket.
    expect(
      issueForPriority({ title: "Water heater service — burner corrosion & exhaust gasket" }).key
    ).toBe("combustion-safety")
    expect(issueForPriority({ title: "Regrade low spot & retaining-wall drainage" }).key).toBe(
      "water-management"
    )
    expect(issueForPriority({ title: "Replace HVAC filter", category: "HVAC" }).key).toBe(
      "hvac-efficiency"
    )
    expect(issueForPriority({ title: "Buy a doormat" })).toBeNull()
  })

  it("clusters only 2+ related open priorities, ranked by escalation risk", () => {
    const clusters = detectIssues([
      { id: "a", title: "Clean window mold + fix ventilation cause" },
      { id: "b", title: "Replace master-bath exhaust fan", reason: "reads 0 CFM" },
      { id: "c", title: "Repair or decommission the basement stove", category: "Safety" },
      { id: "d", title: "Water heater burner corrosion & exhaust gasket", category: "Safety" },
      { id: "e", title: "Re-caulk shower", reason: "hairline gap" }, // unmatched, alone
      { id: "f", title: "Old resolved thing", status: "resolved" }, // excluded
    ])
    const keys = clusters.map((c) => c.issue.key)
    expect(keys).toContain("ventilation")
    expect(keys).toContain("combustion-safety")
    // Combustion's ceiling ($8k) ranks above ventilation ($12k)? ventilation
    // ceiling is higher, so it leads.
    expect(clusters[0].issue.key).toBe("ventilation")
    const vent = clusters.find((c) => c.issue.key === "ventilation")
    expect(vent.items.map((i) => i.id).sort()).toEqual(["a", "b"])
  })

  it("flags near-duplicate titles inside a cluster", () => {
    const dups = findDuplicates([
      { id: "a", title: "Replace master bath exhaust vent" },
      { id: "b", title: "Replace master bathroom exhaust vent fan" },
      { id: "c", title: "Clean window mold" },
    ])
    expect(dups).toContainEqual(["a", "b"])
    expect(dups.flat()).not.toContain("c")
  })

  it("exposes escalation ceiling and a consequence line", () => {
    const iss = issueForPriority({ title: "window mold ventilation" })
    expect(escalationCeiling(iss)).toBe(12000)
    expect(consequenceLine(iss)).toMatch(/Surface mold.*→.*remediation/)
  })
})

describe("issue insights on the Priorities page", () => {
  it("surfaces a related-items cluster for staff", async () => {
    await addItem("prop-ballard", "priorityList", {
      title: "Clean window mold + fix ventilation cause",
      category: "Health",
      reason: "Bath fans at 0 CFM per the audit.",
      urgency: "medium",
    })
    await addItem("prop-ballard", "priorityList", {
      title: "Replace master-bath exhaust fan",
      category: "Ventilation",
      reason: "Reads 0 CFM — not clearing moisture.",
      urgency: "medium",
    })
    renderPage(<PriorityList />)
    expect(await screen.findByText("Related items & escalation risk")).toBeInTheDocument()
    expect(screen.getByText("Moisture ventilation")).toBeInTheDocument()
    expect(screen.getByText(/If deferred:/)).toBeInTheDocument()
    expect(screen.getByText(/Whole-home moisture ventilation project/)).toBeInTheDocument()
  })

  it("bundles a cluster into one work order that carries every priority id", async () => {
    await addItem("prop-ballard", "priorityList", {
      title: "Clean window mold + fix ventilation cause",
      category: "Health",
      reason: "Bath fans at 0 CFM per the audit.",
      urgency: "medium",
    })
    await addItem("prop-ballard", "priorityList", {
      title: "Replace master-bath exhaust fan",
      category: "Ventilation",
      reason: "Reads 0 CFM — not clearing moisture.",
      urgency: "medium",
    })
    renderPage(<PriorityList />)
    fireEvent.click(await screen.findByText(/Bundle 2 into one work order/))
    await waitFor(() => {
      const raised = __getItems("prop-ballard", "workOrders").find(
        (w) => w.bundleKey === "ventilation"
      )
      expect(raised).toBeTruthy()
      expect(raised.priorityIds).toHaveLength(2)
      expect(raised.lane).toBe("triage")
    })
    // The panel now shows the raised state instead of the button.
    expect(await screen.findByText(/Work order raised — track it on the board/)).toBeInTheDocument()
  })

  it("stays hidden from homeowners", async () => {
    await addItem("prop-ridge", "priorityList", {
      title: "Clean window mold + fix ventilation cause",
      urgency: "medium",
    })
    await addItem("prop-ridge", "priorityList", {
      title: "Replace bath exhaust fan",
      urgency: "medium",
    })
    renderPage(<PriorityList />, {
      uid: "prop-ridge",
      user: { email: "alton@example.com", displayName: "Alton", uid: "u-alton" },
    })
    await screen.findAllByText(/exhaust fan|window mold/)
    expect(screen.queryByText("Related items & escalation risk")).not.toBeInTheDocument()
  })
})
