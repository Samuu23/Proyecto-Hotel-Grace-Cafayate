import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import IdleLogout from './components/IdleLogout'
import Navbar from './components/Navbar'
import RequireAdmin from './components/RequireAdmin'
import RequireAuth from './components/RequireAuth'
import RequireGuest from './components/RequireGuest'
import RequireOperador from './components/RequireOperador'
import Account from './pages/Account'
import Admin from './pages/Admin'
import Checkout from './pages/Checkout'
import Contact from './pages/Contact'
import Habitaciones from './pages/Habitaciones'
import Home from './pages/Home'
import Login from './pages/Login'
import Operadores from './pages/Operadores'
import Register from './pages/Register'
import ReservaDetalle from './pages/ReservaDetalle'
import Reservas from './pages/Reservas'

function AppShell() {
  const location = useLocation()
  const hideNav = location.pathname.startsWith('/admin') || location.pathname.startsWith('/operadores')
  return (
    <div className="min-h-full bg-bg text-fg">
      <IdleLogout timeoutMs={5 * 60 * 1000} />
      {!hideNav && <Navbar />}
      <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RequireGuest redirectTo="/account"><Register /></RequireGuest>} />
          <Route path="/reservas" element={<RequireAuth><Reservas /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/habitaciones" element={<RequireAuth><Habitaciones /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/reservas/:id" element={<RequireAuth><ReservaDetalle /></RequireAuth>} />
          <Route path="/contacto" element={<Contact />} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="/operadores" element={<RequireOperador><Operadores /></RequireOperador>} />
        </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
