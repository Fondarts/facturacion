import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileText, Receipt, BarChart3, Home, LogOut, User, Settings as SettingsIcon } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import FacturasList from './pages/FacturasList';
import FacturaEdit from './pages/FacturaEdit';
import FacturaNew from './pages/FacturaNew';
import FacturaBatch from './pages/FacturaBatch';
import Facturar from './pages/Facturar';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import { t } from './i18n';

function NavLink({ to, children, icon: Icon }: { to: string; children: React.ReactNode; icon: React.ElementType }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{children}</span>
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <FileText className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold text-white">Facturación</span>
            </Link>
            
            <nav className="flex items-center gap-2">
              <NavLink to="/" icon={Home}>{t('nav.home')}</NavLink>
              <NavLink to="/facturas" icon={FileText}>{t('nav.expenses')}</NavLink>
              <NavLink to="/generadas" icon={Receipt}>{t('nav.invoices')}</NavLink>
              <NavLink to="/stats" icon={BarChart3}>{t('nav.stats')}</NavLink>
              
              {/* Usuario y logout */}
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-700/50">
                <div className="flex items-center gap-2 text-slate-300">
                  <User size={18} />
                  <span className="text-sm font-medium">{user?.username}</span>
                </div>
                <Link
                  to="/settings"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
                  title={t('nav.settings')}
                >
                  <SettingsIcon size={18} />
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                  title={t('nav.signout')}
                >
                  <LogOut size={18} />
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública de login */}
          <Route path="/login" element={<Login />} />
          
          {/* Rutas protegidas */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/facturas" element={<FacturasList />} />
                    <Route path="/facturas/nueva" element={<FacturaNew />} />
                    <Route path="/facturas/batch" element={<FacturaBatch />} />
                    <Route path="/facturas/:id" element={<FacturaEdit />} />
                    <Route path="/facturar" element={<Facturar />} />
                    <Route path="/generadas" element={<FacturasList lockedTipo="generada" />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/stats" element={<Dashboard />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

