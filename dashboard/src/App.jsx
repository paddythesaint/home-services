import { lazy } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import AuthGate from "./AuthGate"
import Layout from "./Layout"

// Every page is its own chunk — the first paint ships the shell (auth,
// layout, Firebase core) and each page loads on first visit. Overview is
// what everyone lands on, so it rides with the shell eagerly. The Suspense
// boundary lives in Layout, around the Outlet, so the chrome never blinks.
import Overview from "./pages/Overview"
const Walkthrough = lazy(() => import("./pages/Walkthrough"))
const Ops = lazy(() => import("./pages/Ops"))
const HealthReport = lazy(() => import("./pages/HealthReport"))
const CareCalendar = lazy(() => import("./pages/CareCalendar"))
const PriorityList = lazy(() => import("./pages/PriorityList"))
const Forecast = lazy(() => import("./pages/Forecast"))
const JobHistory = lazy(() => import("./pages/JobHistory"))
const Contractors = lazy(() => import("./pages/Contractors"))
const BusinessContractors = lazy(() => import("./pages/BusinessContractors"))
const WorkOrders = lazy(() => import("./pages/WorkOrders"))
const ContractorProfile = lazy(() => import("./pages/ContractorProfile"))
const ImportBundle = lazy(() => import("./pages/ImportBundle"))
const Ideas = lazy(() => import("./pages/Ideas"))
const Assistant = lazy(() => import("./pages/Assistant"))

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthGate>
        {(user) => (
          <Routes>
            <Route path="/" element={<Layout user={user} />}>
              <Route index element={<Overview />} />
              <Route path="walkthrough" element={<Walkthrough />} />
              <Route path="health-report" element={<HealthReport />} />
              <Route path="care-calendar" element={<CareCalendar />} />
              <Route path="priority-list" element={<PriorityList />} />
              <Route path="forecast" element={<Forecast />} />
              <Route path="job-history" element={<JobHistory />} />
              <Route path="contractors" element={<Contractors />} />
              <Route path="import" element={<ImportBundle />} />
              <Route path="ops" element={<Ops />} />
              <Route path="work-orders" element={<WorkOrders />} />
              <Route path="contractor-network" element={<BusinessContractors />} />
              <Route path="contractor-network/:contractorId" element={<ContractorProfile />} />
              <Route path="ideas" element={<Ideas />} />
              <Route path="assistant" element={<Assistant />} />
            </Route>
          </Routes>
        )}
      </AuthGate>
    </BrowserRouter>
  )
}
