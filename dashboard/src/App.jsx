import { BrowserRouter, Routes, Route } from "react-router-dom"
import Layout from "./Layout"
import Overview from "./pages/Overview"
import HealthReport from "./pages/HealthReport"
import CareCalendar from "./pages/CareCalendar"
import PriorityList from "./pages/PriorityList"
import JobHistory from "./pages/JobHistory"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="health-report" element={<HealthReport />} />
          <Route path="care-calendar" element={<CareCalendar />} />
          <Route path="priority-list" element={<PriorityList />} />
          <Route path="job-history" element={<JobHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
