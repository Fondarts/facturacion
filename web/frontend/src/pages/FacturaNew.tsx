import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Upload, Scan, X, Check } from 'lucide-react';
import { createFactura } from '../api';
import { extractTextFromImage, initializeOCR, terminateOCR, ExtractedInvoiceData } from '../services/ocrService';
import { parseInvoiceText } from '../services/invoiceParser';

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
  const [processingOCR, setProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState<ExtractedInvoiceData | null>(null);
  const [showOcrResults, setShowOcrResults] = useState(false);

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

  async function handleProcessOCR() {
    if (!archivo) {
      alert('Por favor, selecciona una imagen primero');
      return;
    }

    // Solo procesar imágenes, no PDFs
    if (!archivo.type.startsWith('image/')) {
      alert('El OCR solo funciona con imágenes. Por favor, selecciona una imagen (JPG, PNG, etc.)');
      return;
    }

    setProcessingOCR(true);
    setOcrProgress(0);
    setOcrResults(null);

    try {
      // Inicializar OCR si no está inicializado
      await initializeOCR((progress) => setOcrProgress(progress));

      // Extraer texto
      const rawText = await extractTextFromImage(archivo, (progress) => setOcrProgress(progress));

      // Parsear datos de la factura
      const parsed = parseInvoiceText(rawText);

      const extractedData: ExtractedInvoiceData = {
        date: parsed.date,
        establishment: parsed.establishment,
        total: parsed.total,
        subtotal: parsed.subtotal,
        tax: parsed.tax,
        taxRate: parsed.taxRate,
        rawText,
        confidence: parsed.confidence,
      };

      setOcrResults(extractedData);
      setShowOcrResults(true);
    } catch (error) {
      console.error('Error procesando OCR:', error);
      alert('Error al procesar la imagen. Por favor, intenta de nuevo.');
    } finally {
      setProcessingOCR(false);
      setOcrProgress(0);
    }
  }

  function applyOcrResults() {
    if (!ocrResults) return;

    const updates: any = {};

    if (ocrResults.establishment) {
      updates.establecimiento = ocrResults.establishment;
    }

    if (ocrResults.date) {
      const dateStr = ocrResults.date.toISOString().split('T')[0];
      updates.fecha = dateStr;
    }

    if (ocrResults.subtotal != null) {
      updates.subtotal = ocrResults.subtotal;
    }

    if (ocrResults.taxRate != null) {
      updates.tasa_iva = ocrResults.taxRate * 100;
    }

    if (ocrResults.tax != null) {
      updates.iva = ocrResults.tax;
    }

    if (ocrResults.total != null) {
      updates.total = ocrResults.total;
    }

    // Recalcular si tenemos subtotal y tasa
    if (updates.subtotal != null && updates.tasa_iva != null) {
      const iva = updates.subtotal * (updates.tasa_iva / 100);
      const total = updates.subtotal + iva;
      updates.iva = iva;
      updates.total = total;
    }

    setFormData({ ...formData, ...updates });
    setShowOcrResults(false);
  }

  // Limpiar OCR al desmontar
  useEffect(() => {
    return () => {
      terminateOCR();
    };
  }, []);

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
          <h1 className="text-2xl font-bold text-white">Ingresar Factura</h1>
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
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setArchivo(file);
                  setOcrResults(null);
                  setShowOcrResults(false);
                }}
                className="hidden"
              />
              <Upload className="mx-auto text-slate-500 mb-3" size={32} />
              {archivo ? (
                <div className="space-y-2">
                  <p className="text-emerald-400">{archivo.name}</p>
                  {archivo.type.startsWith('image/') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProcessOCR();
                      }}
                      disabled={processingOCR}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingOCR ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Procesando OCR...
                        </>
                      ) : (
                        <>
                          <Scan size={16} />
                          Procesar con OCR
                        </>
                      )}
                    </button>
                  )}
                </div>
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

        {/* OCR Results Modal */}
        {showOcrResults && ocrResults && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700/50 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Resultados del OCR</h2>
                <button
                  type="button"
                  onClick={() => setShowOcrResults(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>Confianza:</span>
                  <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full transition-all"
                      style={{ width: `${ocrResults.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-amber-400 font-medium">{Math.round(ocrResults.confidence * 100)}%</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Establecimiento</label>
                    <div className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white">
                      {ocrResults.establishment || <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Fecha</label>
                    <div className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white">
                      {ocrResults.date ? ocrResults.date.toLocaleDateString('es-ES') : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Subtotal</label>
                    <div className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white">
                      {ocrResults.subtotal != null ? `${ocrResults.subtotal.toFixed(2)} €` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">IVA</label>
                    <div className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white">
                      {ocrResults.tax != null ? `${ocrResults.tax.toFixed(2)} €` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tasa IVA</label>
                    <div className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white">
                      {ocrResults.taxRate != null ? `${(ocrResults.taxRate * 100).toFixed(2)}%` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Total</label>
                    <div className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white font-semibold">
                      {ocrResults.total != null ? `${ocrResults.total.toFixed(2)} €` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                    Ver texto extraído
                  </summary>
                  <div className="mt-2 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                      {ocrResults.rawText}
                    </pre>
                  </div>
                </details>

                <div className="flex gap-4 pt-4 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setShowOcrResults(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-slate-300 font-medium hover:bg-slate-600/50 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={applyOcrResults}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
                  >
                    <Check size={20} />
                    Aplicar Datos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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

