import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Loader2, FileText, Download } from 'lucide-react';
import { createFactura, getFacturas } from '../api';
import { FacturaItem } from '../types';
import jsPDF from 'jspdf';

export default function Facturar() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [numeroFactura, setNumeroFactura] = useState<number>(1);
  const [loadingNumero, setLoadingNumero] = useState(true);
  
  const [formData, setFormData] = useState({
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    tasa_iva: 21,
  });
  
  const [items, setItems] = useState<FacturaItem[]>([
    { descripcion: '', cantidad: 1, precio_unitario: 0 }
  ]);

  // Obtener el siguiente número de factura
  useEffect(() => {
    async function loadNextNumber() {
      try {
        const facturas = await getFacturas();
        // Filtrar solo facturas generadas
        const generadas = facturas.filter(f => f.tipo === 'generada');
        
        // Extraer números de factura de los conceptos o usar el índice
        let maxNumero = 0;
        generadas.forEach(f => {
          // Intentar extraer número del concepto si tiene formato "FAC-001" o similar
          const match = f.concepto?.match(/FAC[-\s]?(\d+)/i) || f.concepto?.match(/#(\d+)/i);
          if (match) {
            const num = parseInt(match[1]);
            if (num > maxNumero) maxNumero = num;
          }
        });
        
        setNumeroFactura(maxNumero + 1);
      } catch (error) {
        console.error('Error loading facturas:', error);
      } finally {
        setLoadingNumero(false);
      }
    }
    loadNextNumber();
  }, []);

  // Calcular totales
  const subtotal = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  const iva = subtotal * (formData.tasa_iva / 100);
  const total = subtotal + iva;

  function addItem() {
    setItems([...items, { descripcion: '', cantidad: 1, precio_unitario: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof FacturaItem, value: string | number) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  function exportToPDF() {
    const doc = new jsPDF();
    
    // Configuración
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = margin;

    // Título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Número de factura
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nº FACTURA: FAC-${numeroFactura.toString().padStart(4, '0')}`, margin, yPos);
    yPos += 10;

    // Fecha
    const fechaFormateada = new Date(formData.fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    doc.text(`FECHA: ${fechaFormateada}`, margin, yPos);
    yPos += 15;

    // Cliente
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', margin, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const clienteLines = doc.splitTextToSize(formData.cliente || 'Sin especificar', pageWidth - 2 * margin);
    doc.text(clienteLines, margin, yPos);
    yPos += clienteLines.length * 7 + 10;

    // Concepto (si existe)
    if (formData.concepto) {
      doc.setFont('helvetica', 'bold');
      doc.text('CONCEPTO:', margin, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      const conceptoLines = doc.splitTextToSize(formData.concepto, pageWidth - 2 * margin);
      doc.text(conceptoLines, margin, yPos);
      yPos += conceptoLines.length * 7 + 10;
    }

    // Tabla de items
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    
    // Headers
    doc.text('DESCRIPCIÓN', margin, yPos);
    doc.text('CANT.', margin + 100, yPos);
    doc.text('PRECIO', margin + 120, yPos);
    doc.text('TOTAL', margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    // Línea
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // Items
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    items.forEach((item) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = margin;
      }
      
      const descLines = doc.splitTextToSize(item.descripcion || '', 80);
      const itemTotal = item.cantidad * item.precio_unitario;
      
      doc.text(descLines, margin, yPos);
      doc.text(item.cantidad.toString(), margin + 100, yPos);
      doc.text(formatCurrency(item.precio_unitario), margin + 120, yPos);
      doc.text(formatCurrency(itemTotal), margin + 160, yPos, { align: 'right' });
      
      yPos += Math.max(descLines.length * 5, 8);
    });

    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Totales
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Subtotal:`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrency(subtotal), margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    doc.text(`IVA (${formData.tasa_iva}%):`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrency(iva), margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`TOTAL:`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrency(total), margin + 160, yPos, { align: 'right' });

    // Guardar PDF
    doc.save(`FACTURA-${numeroFactura.toString().padStart(4, '0')}.pdf`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const data = new FormData();
      data.append('establecimiento', formData.cliente.split('\n')[0] || formData.cliente); // Primera línea como establecimiento
      data.append('fecha', formData.fecha);
      data.append('concepto', `FAC-${numeroFactura.toString().padStart(4, '0')} - ${formData.concepto || 'Factura generada'}`);
      data.append('subtotal', subtotal.toString());
      data.append('tasa_iva', (formData.tasa_iva / 100).toString());
      data.append('iva', iva.toString());
      data.append('total', total.toString());
      data.append('tipo', 'generada');
      data.append('items', JSON.stringify(items));

      await createFactura(data);
      navigate('/facturas');
    } catch (error) {
      console.error('Error creating factura:', error);
    } finally {
      setSaving(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  };

  if (loadingNumero) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/facturas"
          className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Facturar</h1>
          <p className="text-slate-400">Crea una factura para tu cliente</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos principales */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText size={20} className="text-amber-400" />
            Datos de la Factura
          </h2>
          
          {/* Número de factura */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Número de Factura
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(parseInt(e.target.value) || 1)}
                className="w-32 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <span className="text-slate-400">FAC-{numeroFactura.toString().padStart(4, '0')}</span>
            </div>
          </div>

          {/* Cliente (textarea grande) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Cliente
            </label>
            <textarea
              value={formData.cliente}
              onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-32 resize-y"
              placeholder="Nombre del cliente&#10;Dirección&#10;Ciudad, Código Postal&#10;Email: cliente@ejemplo.com&#10;Teléfono: 123 456 789"
              required
              rows={6}
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
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
              onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder="Descripción general de la factura"
            />
          </div>
        </div>

        {/* Items */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Conceptos</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              <Plus size={16} />
              Añadir
            </button>
          </div>

          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 text-sm text-slate-400 px-1">
              <div className="col-span-6">Descripción</div>
              <div className="col-span-2 text-center">Cantidad</div>
              <div className="col-span-2 text-center">Precio</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            {/* Items */}
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-6">
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => updateItem(index, 'descripcion', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Descripción del item"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => updateItem(index, 'cantidad', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.precio_unitario || ''}
                    onChange={(e) => updateItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1 text-right text-white font-medium">
                  {formatCurrency(item.cantidad * item.precio_unitario)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex justify-between items-center">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tasa IVA (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.tasa_iva}
                onChange={(e) => setFormData({ ...formData, tasa_iva: parseFloat(e.target.value) || 0 })}
                className="w-24 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            
            <div className="text-right space-y-2">
              <div className="flex justify-between gap-8">
                <span className="text-slate-400">Subtotal:</span>
                <span className="text-white font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-slate-400">IVA ({formData.tasa_iva}%):</span>
                <span className="text-white font-medium">{formatCurrency(iva)}</span>
              </div>
              <div className="flex justify-between gap-8 pt-2 border-t border-slate-700/50">
                <span className="text-white font-semibold">Total:</span>
                <span className="text-2xl font-bold text-amber-400">{formatCurrency(total)}</span>
              </div>
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
            type="button"
            onClick={exportToPDF}
            disabled={items.every(i => !i.descripcion) || !formData.cliente}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-slate-300 font-medium hover:bg-slate-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            Exportar PDF
          </button>
          <button
            type="submit"
            disabled={saving || items.every(i => !i.descripcion) || !formData.cliente}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={20} />
                Guardar Factura
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

