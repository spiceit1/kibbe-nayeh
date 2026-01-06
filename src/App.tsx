import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import HomePage from './pages/Home'
import AboutPage from './pages/About'
import OrderConfirmationPage from './pages/OrderConfirmation'
import AdminPage from './pages/Admin'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
