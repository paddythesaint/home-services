import { BrowserRouter, Routes, Route } from "react-router-dom"
import AuthGate from "./AuthGate"
import Layout from "./Layout"
import Overview from "./pages/Overview"
import Walkthrough from "./pages/Walkthrough"
import Assistant from "./pages/Assistant"
import Ops from "./pages/Ops"
import HealthReport from "./pages/HealthReport"
import CareCalendar from "./pages/CareCalendar"
import PriorityList from "./pages/PriorityList"
import JobHistory from "./pages/JobHistory"
import Contractors from "./pages/Contractors"
import BusinessContractors from "./pages/BusinessContractors"
import ImportBundle from "./pages/ImportBundle"
import ExteriorMeasurements from "./pages/ExteriorMeasurements"

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthGate>
        {(user) => (
          <Routes>
            <Route path="/" element={<Layout user={user} />}>
              <Route index element={<Overview />} />
              <Route path="walkthrough" element={<Walkthrough />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="health-report" element={<HealthReport />} />
              <Route path="care-calendar" element={<CareCalendar />} />
              <Route path="priority-list" element={<PriorityList />} />
              <Route path="job-history" element={<JobHistory />} />
              <Route path="contractors" element={<Contractors />} />
              <Route path="import" element={<ImportBundle />} />
              <Route path="exterior-measurements" element={<ExteriorMeasurements />} />
              <Route path="ops" element={<Ops />} />
              <Route path="contractor-network" element={<BusinessContractors />} />
            </Route>
          </Routes>
        )}
      </AuthGate>
    </BrowserRouter>
  )
}
