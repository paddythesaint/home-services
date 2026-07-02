import { BrowserRouter, Routes, Route } from "react-router-dom"
import AuthGate from "./AuthGate"
import Layout from "./Layout"
import Overview from "./pages/Overview"
import Walkthrough from "./pages/Walkthrough"
import HealthReport from "./pages/HealthReport"
import CareCalendar from "./pages/CareCalendar"
import PriorityList from "./pages/PriorityList"
import JobHistory from "./pages/JobHistory"

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
              <Route path="job-history" element={<JobHistory />} />
            </Route>
          </Routes>
        )}
      </AuthGate>
    </BrowserRouter>
  )
}
