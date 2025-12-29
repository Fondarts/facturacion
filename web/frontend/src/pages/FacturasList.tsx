import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Search, Trash2, Edit, Filter } from 'lucide-react';
import { getFacturas, deleteFactura } from '../api';
import { Factura } from '../types';

export default function FacturasList() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todas' | 'recibida' | 'generada'>('todas');

  useEffect(() => {
    loadFacturas();
  }, []);

  async function loadFacturas() {
    try {
      const data = await getFacturas();
      setFacturas(data);
    } catch (error) {
      console.error('Error loading facturas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta factura?')) return;
    
    try {
      await deleteFactura(id);
      setFacturas(facturas.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting factura:', error);
    }
  }

  const filteredFacturas = facturas.filter(f => {
    const matchesSearch = f.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
                         f.concepto?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'todas' || f.tipo === filter;
    return matchesSearch && matchesFilter;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Facturas</h1>
          <p className="text-slate-400">{facturas.length} facturas registradas</p>
        </div>
        <Link
          to="/facturas/nueva"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-lg shadow-emerald-500/20"
        >
          <Plus size={20} />
          Nueva Factura
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por establecimiento o concepto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          />
        </div>
        
        <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-1">
          <button
            onClick={() => setFilter('todas')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === 'todas' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('recibida')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === 'recibida' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Recibidas
          </button>
          <button
            onClick={() => setFilter('generada')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filter === 'generada' 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Generadas
          </button>
        </div>
      </div>

      {/* Facturas grid */}
      {filteredFacturas.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-12 border border-slate-700/50 text-center">
          <FileText className="mx-auto text-slate-600 mb-4" size={48} />
          <p className="text-slate-400 mb-4">
            {search || filter !== 'todas' ? 'No se encontraron facturas' : 'No hay facturas todavía'}
          </p>
          <Link
            to="/facturas/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            <Plus size={18} />
            Añadir primera factura
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredFacturas.map((factura) => (
            <div
              key={factura.id}
              className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm hover:border-slate-600/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    factura.tipo === 'generada' 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-lg">{factura.establecimiento || 'Sin nombre'}</h3>
                    <p className="text-slate-400 text-sm">
                      {new Date(factura.fecha).toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    {factura.concepto && (
                      <p className="text-slate-500 text-sm mt-1">{factura.concepto}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{formatCurrency(factura.total)}</p>
                    <div className="flex gap-4 text-sm text-slate-400">
                      <span>Base: {formatCurrency(factura.subtotal)}</span>
                      <span>IVA: {formatCurrency(factura.iva)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/facturas/${factura.id}`}
                      className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                    >
                      <Edit size={18} />
                    </Link>
                    <button
                      onClick={() => handleDelete(factura.id)}
                      className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

