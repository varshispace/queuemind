import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import Landing from './pages/Landing.jsx'
import PatientRequest from './pages/PatientRequest.jsx'
import StaffDashboard from './pages/StaffDashboard.jsx'
import ReviewPage from './pages/ReviewPage.jsx'
import Analytics from './pages/Analytics.jsx'
import PolicyAdmin from './pages/PolicyAdmin.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/request" element={<PatientRequest />} />
          <Route path="/login" element={<Login />} />


<Route
 path="/dashboard"
 element={
   <ProtectedRoute>
     <StaffDashboard />
   </ProtectedRoute>
 }
/>


<Route
 path="/review/:id"
 element={
   <ProtectedRoute>
     <ReviewPage />
   </ProtectedRoute>
 }
/>


<Route
 path="/analytics"
 element={
   <ProtectedRoute>
     <Analytics />
   </ProtectedRoute>
 }
/>


<Route
 path="/policy"
 element={
   <ProtectedRoute>
     <PolicyAdmin />
   </ProtectedRoute>
 }
/>
        </Routes>
      </main>
      <footer className="text-center text-xs text-mind-400 py-6">
        QueueMind AI — hackathon demo. Not a medical diagnosis system. AI understands, policy routes, people decide.
      </footer>
    </div>
  )
}
