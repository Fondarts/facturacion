import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Upload } from 'lucide-react';
import { createFactura } from '../api';

export default function FacturaNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    establecimiento: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    subtotal: 0,
    tasa_iva: 10,
    iva: 0,
    total: 0,
  });
  const [archivo, setArchivo] = useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const data = new FormData();
      data.append('establecimiento', formData.establecimiento);
      data.append('fecha', formData.fecha);
      data.append('concepto', formData.concepto);
      data.append('subtotal', formData.subtotal.toString());
      data.append('tasa_iva', (formData.tasa_iva / 100).toString());
      data.append('iva', formData.iva.toString());
      data.append('total', formData.total.toString());
      data.append('tipo', 'recibida');
      
      if (archivo) {
        data.append('archivo', archivo);
      }

      await createFactura(data);
      navigate('/facturas');
    } catch (error) {
      console.error('Error creating factura:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: string, value: string | number) {
    setFormData({ ...formData, [field]: value });
  }

  function recalculateFromSubtotal(subtotal: number) {
    const iva = subtotal * (formData.tasa_iva / 100);
    const total = subtotal + iva;
    setFormData({ ...formData, subtotal, iva, total });
  }

  function recalculateFromTasa(tasa: number) {
    const iva = formData.subtotal * (tasa / 100);
    const total = formData.subtotal + iva;
    setFormData({ ...formData, tasa_iva: tasa, iva, total });
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
          <h1 className="text-2xl font-bold text-white">Nueva Factura</h1>
          <p className="text-slate-400">Registrar una factura recibida</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 space-y-6">
          {/* Archivo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Archivo (opcional)
            </label>
            <div 
              className="border-2 border-dashed border-slate-700/50 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Upload className="mx-auto text-slate-500 mb-3" size={32} />
              {archivo ? (
                <p className="text-emerald-400">{archivo.name}</p>
              ) : (
                <p className="text-slate-400">Arrastra un archivo o haz clic para seleccionar</p>
              )}
            </div>
          </div>

          {/* Establecimiento */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Establecimiento
            </label>
            <input
              type="text"
              value={formData.establecimiento}
              onChange={(e) => handleChange('establecimiento', e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Nombre del establecimiento"
              required
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Fecha
            </label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => handleChange('fecha', e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              required
            />
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Concepto
            </label>
            <input
              type="text"
              value={formData.concepto}
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
                value={formData.subtotal || ''}
                onChange={(e) => recalculateFromSubtotal(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tasa IVA (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.tasa_iva || ''}
                onChange={(e) => recalculateFromTasa(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="10"
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
                value={formData.iva.toFixed(2)}
                readOnly
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Total
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.total.toFixed(2)}
                readOnly
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white font-semibold cursor-not-allowed"
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
                Crear Factura
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

