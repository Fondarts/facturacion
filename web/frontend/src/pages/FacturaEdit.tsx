import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { getFactura, updateFactura } from '../api';
import { Factura } from '../types';

export default function FacturaEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [factura, setFactura] = useState<Factura | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getFactura(id);
        setFactura(data);
      } catch (error) {
        console.error('Error loading factura:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factura || !id) return;

    setSaving(true);
    try {
      await updateFactura(id, factura);
      navigate('/facturas');
    } catch (error) {
      console.error('Error updating factura:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: keyof Factura, value: string | number) {
    if (!factura) return;
    setFactura({ ...factura, [field]: value });
  }

  // Recalcular total cuando cambian subtotal o IVA
  function recalculateFromSubtotal(subtotal: number) {
    if (!factura) return;
    const iva = subtotal * (factura.tasa_iva || 0.1);
    const total = subtotal + iva;
    setFactura({ ...factura, subtotal, iva, total });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!factura) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Factura no encontrada</p>
        <Link to="/facturas" className="text-emerald-400 hover:underline">
          Volver a facturas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/facturas"
          className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Editar Factura</h1>
          <p className="text-slate-400">{factura.establecimiento || 'Sin nombre'}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 space-y-6">
          {/* Establecimiento */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Establecimiento
            </label>
            <input
              type="text"
              value={factura.establecimiento || ''}
              onChange={(e) => handleChange('establecimiento', e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Nombre del establecimiento"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Fecha
            </label>
            <input
              type="date"
              value={factura.fecha?.split('T')[0] || ''}
              onChange={(e) => handleChange('fecha', e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Concepto
            </label>
            <input
              type="text"
              value={factura.concepto || ''}
              onChange={(e) => handleChange('concepto', e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Descripción o concepto"
            />
          </div>

          {/* Valores monetarios */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Subtotal (Base)
              </label>
              <input
                type="number"
                step="0.01"
                value={factura.subtotal || 0}
                onChange={(e) => recalculateFromSubtotal(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tasa IVA (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={(factura.tasa_iva || 0) * 100}
                onChange={(e) => {
                  const tasa = (parseFloat(e.target.value) || 0) / 100;
                  const iva = (factura.subtotal || 0) * tasa;
                  setFactura({ ...factura, tasa_iva: tasa, iva, total: (factura.subtotal || 0) + iva });
                }}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                IVA
              </label>
              <input
                type="number"
                step="0.01"
                value={factura.iva || 0}
                onChange={(e) => {
                  const iva = parseFloat(e.target.value) || 0;
                  setFactura({ ...factura, iva, total: (factura.subtotal || 0) + iva });
                }}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Total
              </label>
              <input
                type="number"
                step="0.01"
                value={factura.total || 0}
                onChange={(e) => handleChange('total', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            to="/facturas"
            className="flex-1 px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 font-medium text-center hover:bg-slate-700/50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={20} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

