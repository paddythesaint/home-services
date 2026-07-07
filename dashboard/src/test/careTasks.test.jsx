// The completion loop: a care task can be marked done for the year (from
// the calendar, or via the assistant's log_job action), which writes the
// job history and hides the task from What's Next until the year rolls
// over. The mock store resets between tests, so each test sets its own
// stage.

import { describe, it, expect } from "vitest"
import { screen, fireEvent, waitFor, within } from "@testing-library/react"
import { renderPage } from "./renderPage"
import CareCalendar from "../pages/CareCalendar"
import WhatsNext from "../pages/WhatsNext"
import Assistant from "../pages/Assistant"
import { __getItems, updateItem } from "../mocks/firestoreApi"

const thisYear = new Date().getFullYear()

describe("care task completion loop", () => {
  it("mark done stamps the year and offers a prefilled job log", async () => {
    renderPage(<CareCalendar />)
    const row = (await screen.findByText("Flush water heater")).closest("li")
    fireEvent.click(within(row).getByText("mark done"))

    // The follow-on modal, prefilled with the task.
    expect(
      await screen.findByText(/log "Flush water heater" as a job\?/)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText("Log job"))

    await waitFor(() => {
      const job = __getItems("prop-ballard", "jobHistory").find(
        (j) => j.title === "Flush water heater"
      )
      expect(job).toMatchObject({
        status: "completed",
        category: "Plumbing",
        sub: "Owner (DIY)",
      })
    })
    const cal = __getItems("prop-ballard", "careCalendar").find(
      (t) => t.task === "Flush water heater"
    )
    expect(cal.doneYear).toBe(thisYear)
    // The calendar row now reads as done.
    expect(await screen.findByText(/· done /)).toBeInTheDocument()
  })

  it("What's Next drops a task once it's done for the year", async () => {
    // The store resets between tests — stamp the task done directly.
    const cal = __getItems("prop-ballard", "careCalendar").find(
      (t) => t.task === "Flush water heater"
    )
    await updateItem("prop-ballard", "careCalendar", cal.id, {
      doneOn: "July 7, 2026",
      doneYear: thisYear,
    })
    renderPage(<WhatsNext />)
    await screen.findAllByText("What's Next")
    expect(screen.queryByText("Flush water heater")).not.toBeInTheDocument()
    expect(screen.getByText("Inspect deck boards")).toBeInTheDocument()
  })

  it("assistant flow-through: reported work logs the job AND checks the task", async () => {
    renderPage(<Assistant />)
    await screen.findByText(/I'm the HPS assistant/)
    fireEvent.change(screen.getByPlaceholderText(/Ask about the home/), {
      target: { value: "I flushed the water heater on Saturday" },
    })
    fireEvent.click(screen.getByLabelText("Send"))

    expect(await screen.findByText(/Log job: "Flushed water heater"/)).toBeInTheDocument()
    // Nothing written until confirmed.
    expect(
      __getItems("prop-ballard", "jobHistory").find((j) => j.title === "Flushed water heater")
    ).toBeUndefined()
    fireEvent.click(screen.getByText("Log job"))
    await screen.findByText(/Logged — job history \+ care calendar updated/)

    const job = __getItems("prop-ballard", "jobHistory").find(
      (j) => j.title === "Flushed water heater"
    )
    expect(job).toMatchObject({ status: "completed", via: "assistant", sub: "Owner (DIY)" })
    const cal = __getItems("prop-ballard", "careCalendar").find(
      (t) => t.task === "Flush water heater"
    )
    expect(cal.doneYear).toBe(thisYear)
  })
})
