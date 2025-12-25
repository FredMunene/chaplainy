import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import HostPage from './pages/HostPage'
import SessionPage from './pages/SessionPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HostPage />} />
      <Route path="/session/:id" element={<SessionPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
