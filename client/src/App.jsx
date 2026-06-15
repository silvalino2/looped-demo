import { Routes, Route, Navigate } from 'react-router-dom'
import Upload from './pages/Upload'
import ClipHistory from './pages/ClipHistory'
import ClipDetail from './pages/ClipDetail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Upload />} />
      <Route path="/history" element={<ClipHistory />} />
      <Route path="/clips/:jobId" element={<ClipDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
