// The Home newsfeed: acknowledgment without a new screen. Emails received
// (and what auto-filed from them), work done, and briefs sent merge into
// the Recent-activity surfaces that already exist on both Homes.

import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { homeFeed } from "../homeFeed"
import Overview from "../pages/Overview"

const ALTON = { email: "alton@example.com", displayName: "Alton", uid: "u-alton" }

describe("homeFeed (pure)", () => {
  it("merges jobs, intake emails, and briefs, newest first", () => {
    const feed = homeFeed({
      jobs: [
        { title: "Gutter cleaning", date: "July 20, 2026", sub: "Blue Ridge", status: "completed" },
        { title: "Not done yet", date: "July 26, 2026", status: "scheduled" },
      ],
      conversations: [
        {
          source: "email-intake",
          startedOn: "July 27, 2026",
          order: Date.parse("2026-07-27T18:00:00Z"),
          summary: "Email intake: Fwd: Insight report",
          messages: [
            {
              role: "assistant",
              actions: [
                { type: "save_fact", status: "done", auto: true },
                { type: "save_fact", status: "done", auto: true },
                { type: "service_request", status: "pending" },
              ],
            },
          ],
        },
        { source: "assistant", startedOn: "July 25, 2026", summary: "chat" }, // not intake → excluded
      ],
      briefs: [{ createdOn: "July 21, 2026", order: Date.parse("2026-07-21"), sentTo: ["a", "b"] }],
    })
    expect(feed.map((e) => e.kind)).toEqual(["email", "brief", "job"])
    expect(feed[0].title).toBe("Received: Fwd: Insight report")
    expect(feed[0].detail).toBe("2 entries filed to the record · 1 awaiting your OK")
    expect(feed[1].detail).toBe("to 2 members")
    // Scheduled job stays out; only completed work is "done".
    expect(feed.some((e) => e.title === "Not done yet")).toBe(false)
  })

  it("an intake with nothing structured still acknowledges receipt", () => {
    const feed = homeFeed({
      conversations: [
        { source: "email-intake", startedOn: "July 27, 2026", summary: "Email intake: Time renewal", messages: [] },
      ],
    })
    expect(feed[0].detail).toBe("read and archived")
  })
})

describe("the feed on both Homes", () => {
  it("founder Home: Recent activity acknowledges the received email", async () => {
    renderPage(<Overview />)
    expect(await screen.findByText(/Received: Fwd: Insight report/)).toBeInTheDocument()
    expect(screen.getByText(/2 entries filed to the record/)).toBeInTheDocument()
  })

  it("homeowner Home: the Recently stream carries the acknowledgment too", async () => {
    renderPage(<Overview />, { user: ALTON })
    expect(await screen.findByText(/Received: Fwd: Insight report/)).toBeInTheDocument()
  })
})
