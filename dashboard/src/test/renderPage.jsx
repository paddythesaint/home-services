// Render a page component the way Layout does in the real app: inside a
// router, with the outlet context ({ uid, profile, saveProfile, user })
// pages read via useOutletContext.

import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom"
import { render } from "@testing-library/react"
import { MOCK_FOUNDER, fixtureData } from "../mocks/fixtures"
import { saveProperty } from "../mocks/firestoreApi"

export const DEFAULT_UID = "prop-ballard"

export function renderPage(page, { uid = DEFAULT_UID, user = MOCK_FOUNDER } = {}) {
  const profile = structuredClone(fixtureData.properties[uid].profile)
  const context = {
    uid,
    profile,
    saveProfile: (data) => saveProperty(uid, data),
    user,
    portfolio: null,
    setActiveProperty: () => {},
    refreshPortfolio: async () => [],
  }
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route index element={page} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}
