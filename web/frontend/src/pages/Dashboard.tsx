import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, TrendingUp, Receipt, Plus, ArrowRight } from 'lucide-react';
import { getStats, getFacturas } from '../api';
import { Stats, Factura } from '../types';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentFacturas, setRecentFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, facturasData] = await Promise.all([
          getStats(),
          getFacturas()
        ]);
        setStats(statsData);
        setRecentFacturas(facturasData.slice(0, 5));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  };

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Resumen de tus facturas y gastos</p>
        </div>
        <Link
          to="/facturas/nueva"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-lg shadow-emerald-500/20"
        >
          <Plus size={20} />
          Ingresar Factura
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <FileText className="text-emerald-400" size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Facturas</p>
              <p className="text-2xl font-bold text-white">{stats?.totalFacturas || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <TrendingUp className="text-amber-400" size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Gastado</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalGastado || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Receipt className="text-rose-400" size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total IVA</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalIva || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Facturas Recientes</h2>
          <Link to="/facturas" className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-sm">
            Ver todas <ArrowRight size={16} />
          </Link>
        </div>
        
        {recentFacturas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto text-slate-600 mb-4" size={48} />
            <p className="text-slate-400 mb-4">No hay facturas todavía</p>
            <Link
              to="/facturas/nueva"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            >
              <Plus size={18} />
              Añadir primera factura
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {recentFacturas.map((factura) => (
              <Link
                key={factura.id}
                to={`/facturas/${factura.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    factura.tipo === 'generada' 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-white">{factura.establecimiento || 'Sin nombre'}</p>
                    <p className="text-sm text-slate-400">
                      {new Date(factura.fecha).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">{formatCurrency(factura.total)}</p>
                  <p className="text-sm text-slate-400">IVA: {formatCurrency(factura.iva)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Monthly chart placeholder */}
      {stats?.porMes && stats.porMes.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-4">Gastos por Mes</h2>
          <div className="space-y-3">
            {stats.porMes.map((mes) => (
              <div key={mes.mes} className="flex items-center gap-4">
                <span className="text-slate-400 w-20 text-sm">{mes.mes}</span>
                <div className="flex-1 bg-slate-700/30 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-end pr-3"
                    style={{ width: `${Math.min((mes.total / (stats.totalGastado || 1)) * 100 * 3, 100)}%` }}
                  >
                    <span className="text-xs font-medium text-white">{formatCurrency(mes.total)}</span>
                  </div>
                </div>
                <span className="text-slate-400 text-sm w-20 text-right">{mes.cantidad} fact.</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

