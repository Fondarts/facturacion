import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Upload, Scan, X, Check, Save, Loader2, Trash2 } from 'lucide-react';
import { createFactura } from '../api';
import { extractInvoiceData, initializeOCR, terminateOCR, ExtractedInvoiceData } from '../services/ocrService';

interface BatchInvoice {
  id: string;
  file: File;
  processing: boolean;
  ocrResults: ExtractedInvoiceData | null;
  formData: {
    establecimiento: string;
    fecha: string;
    concepto: string;
    subtotal: number;
    tasa_iva: number;
    iva: number;
    total: number;
  };
  applied: boolean;
  saving: boolean;
}

export default function FacturaBatch() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<BatchInvoice[]>([]);
  const [processingAll, setProcessingAll] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    return () => {
      terminateOCR();
    };
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 10);
    
    const newInvoices: BatchInvoice[] = files.map((file, index) => ({
      id: `invoice-${Date.now()}-${index}`,
      file,
      processing: false,
      ocrResults: null,
      formData: {
        establecimiento: '',
        fecha: new Date().toISOString().split('T')[0],
        concepto: '',
        subtotal: 0,
        tasa_iva: 10,
        iva: 0,
        total: 0,
      },
      applied: false,
      saving: false,
    }));

    setInvoices((prev) => [...prev, ...newInvoices].slice(0, 10));
    e.target.value = ''; // Reset input
  }

  async function processInvoiceOCR(invoiceId: string) {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice || !invoice.file.type.startsWith('image/')) {
      alert('Solo se pueden procesar imágenes con OCR');
      return;
    }

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, processing: true } : inv))
    );

    try {
      await initializeOCR();
      const extractedData = await extractInvoiceData(invoice.file);

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                ocrResults: extractedData,
                processing: false,
              }
            : inv
        )
      );
    } catch (error: any) {
      console.error('Error procesando OCR:', error);
      const errorMessage = error?.message || 'Error al procesar la imagen. Por favor, intenta de nuevo.';
      alert(errorMessage);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, processing: false } : inv))
      );
    }
  }

  async function processAllOCR() {
    if (invoices.length === 0) return;

    setProcessingAll(true);
    await initializeOCR();

    for (const invoice of invoices) {
      if (invoice.file.type.startsWith('image/') && !invoice.ocrResults) {
        await processInvoiceOCR(invoice.id);
        // Pequeña pausa entre procesamientos para no saturar
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setProcessingAll(false);
  }

  function applyOcrResults(invoiceId: string) {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice || !invoice.ocrResults) return;

    const updates: any = {};

    if (invoice.ocrResults.establishment) {
      updates.establecimiento = invoice.ocrResults.establishment;
    }

    if (invoice.ocrResults.date) {
      updates.fecha = invoice.ocrResults.date.toISOString().split('T')[0];
    }

    if (invoice.ocrResults.subtotal != null) {
      updates.subtotal = invoice.ocrResults.subtotal;
    }

    if (invoice.ocrResults.taxRate != null) {
      updates.tasa_iva = invoice.ocrResults.taxRate * 100;
    }

    if (invoice.ocrResults.tax != null) {
      updates.iva = invoice.ocrResults.tax;
    }

    if (invoice.ocrResults.total != null) {
      updates.total = invoice.ocrResults.total;
    }

    // Recalcular si tenemos subtotal y tasa
    if (updates.subtotal != null && updates.tasa_iva != null) {
      const iva = updates.subtotal * (updates.tasa_iva / 100);
      const total = updates.subtotal + iva;
      updates.iva = iva;
      updates.total = total;
    }

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              formData: { ...inv.formData, ...updates },
              applied: true,
            }
          : inv
      )
    );
  }

  function removeInvoice(invoiceId: string) {
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
  }

  function updateInvoiceField(invoiceId: string, field: string, value: string | number) {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const newFormData = { ...inv.formData, [field]: value };
          
          // Recalcular si cambia subtotal o tasa
          if (field === 'subtotal' || field === 'tasa_iva') {
            const subtotal = field === 'subtotal' ? (value as number) : newFormData.subtotal;
            const tasa = field === 'tasa_iva' ? (value as number) : newFormData.tasa_iva;
            const iva = subtotal * (tasa / 100);
            const total = subtotal + iva;
            newFormData.iva = iva;
            newFormData.total = total;
          }

          return { ...inv, formData: newFormData };
        }
        return inv;
      })
    );
  }

  async function saveInvoice(invoiceId: string) {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, saving: true } : inv))
    );

    try {
      const data = new FormData();
      data.append('establecimiento', invoice.formData.establecimiento);
      data.append('fecha', invoice.formData.fecha);
      data.append('concepto', invoice.formData.concepto);
      data.append('subtotal', invoice.formData.subtotal.toString());
      data.append('tasa_iva', (invoice.formData.tasa_iva / 100).toString());
      data.append('iva', invoice.formData.iva.toString());
      data.append('total', invoice.formData.total.toString());
      data.append('tipo', 'recibida');
      data.append('archivo', invoice.file);

      await createFactura(data);

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, saving: false, applied: true } : inv))
      );
    } catch (error) {
      console.error('Error guardando factura:', error);
      alert('Error al guardar la factura');
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, saving: false } : inv))
      );
    }
  }

  async function saveAll() {
    if (invoices.length === 0) return;

    setSavingAll(true);
    const validInvoices = invoices.filter(
      (inv) => inv.formData.establecimiento && inv.formData.total > 0
    );

    for (const invoice of validInvoices) {
      await saveInvoice(invoice.id);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setSavingAll(false);
    navigate('/facturas');
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/facturas"
          className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Ingresar Facturas en Lote</h1>
          <p className="text-slate-400">Procesa hasta 10 facturas a la vez</p>
        </div>
        {invoices.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={processAllOCR}
              disabled={processingAll || invoices.every((inv) => inv.ocrResults || !inv.file.type.startsWith('image/'))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingAll ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Scan size={16} />
                  Procesar Todas con OCR
                </>
              )}
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={savingAll || invoices.length === 0 || invoices.some((inv) => !inv.formData.establecimiento || inv.formData.total <= 0)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingAll ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Guardar Todas ({invoices.filter((inv) => inv.formData.establecimiento && inv.formData.total > 0).length})
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* File Upload */}
      {invoices.length < 10 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Seleccionar facturas (máximo 10, {invoices.length}/10 seleccionadas)
          </label>
          <div
            className="border-2 border-dashed border-slate-700/50 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById('batch-file-input')?.click()}
          >
            <input
              id="batch-file-input"
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="mx-auto text-slate-500 mb-3" size={32} />
            <p className="text-slate-400">
              Arrastra archivos o haz clic para seleccionar (máximo 10)
            </p>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="space-y-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-slate-400">
                    {invoice.file.name}
                  </span>
                  {invoice.ocrResults && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400">
                      {Math.round(invoice.ocrResults.confidence * 100)}% confianza
                    </span>
                  )}
                  {invoice.applied && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                      Datos aplicados
                    </span>
                  )}
                </div>
                {invoice.file.type.startsWith('image/') && (
                  <button
                    type="button"
                    onClick={() => processInvoiceOCR(invoice.id)}
                    disabled={invoice.processing}
                    className="text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {invoice.processing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Procesando...
                      </>
                    ) : invoice.ocrResults ? (
                      <>
                        <Check size={14} />
                        OCR Completado
                      </>
                    ) : (
                      <>
                        <Scan size={14} />
                        Procesar con OCR
                      </>
                    )}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeInvoice(invoice.id)}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* OCR Results */}
            {invoice.ocrResults && (
              <div className="mb-4 p-4 bg-slate-900/50 rounded-xl border border-amber-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-400">Resultados del OCR</span>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                        <div
                          className="bg-amber-400 h-2 rounded-full transition-all"
                          style={{ width: `${invoice.ocrResults.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-amber-400 font-medium">{Math.round(invoice.ocrResults.confidence * 100)}%</span>
                    </div>
                  </div>
                  {!invoice.applied && (
                    <button
                      type="button"
                      onClick={() => applyOcrResults(invoice.id)}
                      className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                    >
                      <Check size={12} />
                      Aplicar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Establecimiento</label>
                    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm">
                      {invoice.ocrResults.establishment || <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Fecha</label>
                    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm">
                      {invoice.ocrResults.date ? invoice.ocrResults.date.toLocaleDateString('es-ES') : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Subtotal</label>
                    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm">
                      {invoice.ocrResults.subtotal != null ? `${invoice.ocrResults.subtotal.toFixed(2)} €` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">IVA</label>
                    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm">
                      {invoice.ocrResults.tax != null ? `${invoice.ocrResults.tax.toFixed(2)} €` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Tasa IVA</label>
                    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm">
                      {invoice.ocrResults.taxRate != null ? `${(invoice.ocrResults.taxRate * 100).toFixed(2)}%` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Total</label>
                    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white font-semibold text-sm">
                      {invoice.ocrResults.total != null ? `${invoice.ocrResults.total.toFixed(2)} €` : <span className="text-slate-500">No detectado</span>}
                    </div>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                    Ver texto extraído
                  </summary>
                  <div className="mt-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                      {invoice.ocrResults.rawText}
                    </pre>
                  </div>
                </details>
              </div>
            )}

            {/* Form */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Establecimiento *
                </label>
                <input
                  type="text"
                  value={invoice.formData.establecimiento}
                  onChange={(e) => updateInvoiceField(invoice.id, 'establecimiento', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Nombre"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={invoice.formData.fecha}
                  onChange={(e) => updateInvoiceField(invoice.id, 'fecha', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subtotal</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoice.formData.subtotal || ''}
                  onChange={(e) => updateInvoiceField(invoice.id, 'subtotal', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tasa IVA (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoice.formData.tasa_iva || ''}
                  onChange={(e) => updateInvoiceField(invoice.id, 'tasa_iva', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">IVA</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoice.formData.iva.toFixed(2)}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Total *</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoice.formData.total.toFixed(2)}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-700/50 rounded-lg text-white font-semibold cursor-not-allowed"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Concepto</label>
                <input
                  type="text"
                  value={invoice.formData.concepto}
                  onChange={(e) => updateInvoiceField(invoice.id, 'concepto', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Descripción"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => saveInvoice(invoice.id)}
                disabled={invoice.saving || !invoice.formData.establecimiento || invoice.formData.total <= 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {invoice.saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {invoices.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Upload className="mx-auto mb-4 text-slate-500" size={48} />
          <p>Selecciona hasta 10 facturas para procesarlas en lote</p>
        </div>
      )}
    </div>
  );
}

