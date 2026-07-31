// Render a page component the way Layout does in the real app: inside a
// router, with the outlet context ({ uid, profile, saveProfile, user })
// pages read via useOutletContext.

import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom"
import { render } from "@testing-library/react"
import { MOCK_FOUNDER, fixtureData } from "../mocks/fixtures"
import { saveProperty, __getProfile } from "../mocks/firestoreApi"
import { ViewModeProvider } from "../components"

export const DEFAULT_UID = "prop-ballard"

export function renderPage(
  page,
  { uid = DEFAULT_UID, user = MOCK_FOUNDER, path, routePath } = {}
) {
  // Fixtures first; fall back to the live mock store so tests can render
  // pages for properties they created via createProperty.
  const profile = fixtureData.properties[uid]
    ? structuredClone(fixtureData.properties[uid].profile)
    : __getProfile(uid)
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
    <ViewModeProvider>
      <MemoryRouter initialEntries={[path || "/"]}>
        <Routes>
          <Route element={<Outlet context={context} />}>
            {routePath ? (
              <Route path={routePath} element={page} />
            ) : (
              <Route index element={page} />
            )}
          </Route>
        </Routes>
      </MemoryRouter>
    </ViewModeProvider>
  )
}
