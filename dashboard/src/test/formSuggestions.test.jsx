// Smart completion: DynamicForm fields can carry `suggestions` — values
// the record already knows — rendered as a native datalist (free text
// still allowed, works on phones). Pages feed it from their own data.

import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DynamicForm } from "../components"
import { renderPage } from "./renderPage"
import JobHistory from "../pages/JobHistory"
import HealthReport from "../pages/HealthReport"

describe("DynamicForm suggestions", () => {
  it("renders a datalist for suggestion-bearing fields, deduped", () => {
    const { container } = render(
      <DynamicForm
        fields={[
          { name: "sub", label: "Contractor", type: "text", suggestions: ["Monticello Air", "Monticello Air", "", "Sunwave Plumbing"] },
          { name: "plain", label: "Plain", type: "text" },
        ]}
        onSubmit={() => {}}
      />
    )
    const dl = container.querySelector("datalist#dl-sub")
    expect(dl).not.toBeNull()
    expect([...dl.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "Monticello Air",
      "Sunwave Plumbing",
    ])
    // Input is wired to it; plain fields get no datalist.
    expect(container.querySelector('input[list="dl-sub"]')).not.toBeNull()
    expect(container.querySelector("datalist#dl-plain")).toBeNull()
  })

  it("Job History offers roster contractors and system categories", async () => {
    renderPage(<JobHistory />)
    fireEvent.click(await screen.findByText("+ Add job"))
    const dlCat = document.querySelector("datalist#dl-category")
    expect(dlCat).not.toBeNull()
    const cats = [...dlCat.querySelectorAll("option")].map((o) => o.value)
    expect(cats).toContain("HVAC")
  })

  it("Health of the house offers existing brands and locations", async () => {
    renderPage(<HealthReport />)
    fireEvent.click((await screen.findAllByText("+ Add system"))[0])
    const dlBrand = document.querySelector("datalist#dl-brand")
    const dlLoc = document.querySelector("datalist#dl-location")
    expect(dlBrand).not.toBeNull()
    expect(dlLoc).not.toBeNull()
    expect([...dlBrand.querySelectorAll("option")].length).toBeGreaterThan(0)
  })
})
