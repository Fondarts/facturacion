import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileText, Plus, BarChart3, Home } from 'lucide-react';
import FacturasList from './pages/FacturasList';
import FacturaEdit from './pages/FacturaEdit';
import FacturaNew from './pages/FacturaNew';
import Facturar from './pages/Facturar';
import Dashboard from './pages/Dashboard';

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
              <NavLink to="/" icon={Home}>Inicio</NavLink>
              <NavLink to="/facturas" icon={FileText}>Facturas</NavLink>
              <NavLink to="/stats" icon={BarChart3}>Estadísticas</NavLink>
              <Link
                to="/facturar"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-lg shadow-emerald-500/20"
              >
                <Plus size={18} />
                Facturar
              </Link>
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
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/facturas" element={<FacturasList />} />
          <Route path="/facturas/nueva" element={<FacturaNew />} />
          <Route path="/facturas/:id" element={<FacturaEdit />} />
          <Route path="/facturar" element={<Facturar />} />
          <Route path="/stats" element={<Dashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

