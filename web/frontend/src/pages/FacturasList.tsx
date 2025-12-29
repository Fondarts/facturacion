import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Search, Trash2, Edit, Calendar, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { getFacturas, deleteFactura } from '../api';
import { Factura, FacturaItem } from '../types';
import FileViewer from '../components/FileViewer';
import jsPDF from 'jspdf';

interface MonthGroup {
  month: string;
  monthName: string;
  facturas: Factura[];
  total: number;
  iva: number;
}

export default function FacturasList() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todas' | 'recibida' | 'generada'>('todas');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFacturas();
  }, []);

  async function loadFacturas() {
    try {
      const data = await getFacturas();
      setFacturas(data);
      // Expandir el primer mes por defecto
      if (data.length > 0) {
        const firstMonth = data[0]?.fecha?.substring(0, 7);
        if (firstMonth) {
          setExpandedMonths(new Set([firstMonth]));
        }
      }
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

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

  const filteredFacturas = facturas.filter(f => {
    const matchesSearch = f.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
                         f.concepto?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'todas' || f.tipo === filter;
    return matchesSearch && matchesFilter;
  });

  // Agrupar facturas por mes
  const groupedByMonth: MonthGroup[] = filteredFacturas.reduce((groups: MonthGroup[], factura) => {
    const month = factura.fecha?.substring(0, 7) || 'unknown';
    let group = groups.find(g => g.month === month);
    
    if (!group) {
      const date = new Date(factura.fecha + 'T00:00:00');
      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      group = { 
        month, 
        monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        facturas: [], 
        total: 0, 
        iva: 0 
      };
      groups.push(group);
    }
    
    group.facturas.push(factura);
    group.total += factura.total || 0;
    group.iva += factura.iva || 0;
    
    return groups;
  }, []).sort((a, b) => b.month.localeCompare(a.month));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  };

  function generatePDFFromFactura(factura: Factura) {
    const doc = new jsPDF();
    
    // Usar datos guardados o valores por defecto
    const idioma = factura.idioma || 'es';
    const moneda = factura.moneda || 'EUR';
    const formatoFecha = factura.formatoFecha || 'DD/MM/YYYY';
    const numeroFactura = factura.numeroFactura || factura.concepto?.match(/FAC[-\s]?([^\s-]+)/i)?.[1] || factura.id.substring(0, 8);
    
    const texts = idioma === 'en' ? {
      factura: 'INVOICE',
      numeroFactura: 'INVOICE NO:',
      fecha: 'DATE:',
      de: 'FROM:',
      para: 'TO:',
      descripcion: 'DESCRIPTION',
      cantidad: 'QTY',
      precio: 'PRICE',
      total: 'TOTAL',
      subtotal: 'Subtotal:',
      iva: 'VAT',
      totalFinal: 'TOTAL:',
      sinNumero: 'No number',
      sinEspecificar: 'Not specified'
    } : {
      factura: 'FACTURA',
      numeroFactura: 'Nº FACTURA:',
      fecha: 'FECHA:',
      de: 'DE:',
      para: 'PARA:',
      descripcion: 'DESCRIPCIÓN',
      cantidad: 'CANT.',
      precio: 'PRECIO',
      total: 'TOTAL',
      subtotal: 'Subtotal:',
      iva: 'IVA',
      totalFinal: 'TOTAL:',
      sinNumero: 'Sin número',
      sinEspecificar: 'Sin especificar'
    };

    const formatCurrencyPDF = (value: number) => {
      return new Intl.NumberFormat('es-ES', { 
        style: 'currency', 
        currency: moneda 
      }).format(value);
    };

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr + 'T00:00:00');
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();

      switch (formatoFecha) {
        case 'DD/MM/YYYY':
          return `${day}/${month}/${year}`;
        case 'MM/DD/YYYY':
          return `${month}/${day}/${year}`;
        case 'YYYY-MM-DD':
          return `${year}-${month}-${day}`;
        case 'DD-MM-YYYY':
          return `${day}-${month}-${year}`;
        default:
          return `${day}/${month}/${year}`;
      }
    };
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const columnWidth = (pageWidth - 2 * margin - 20) / 2;
    let yPos = margin;

    // Título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(texts.factura, margin, yPos);
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${texts.numeroFactura} ${numeroFactura}`, margin, yPos);
    yPos += 10;

    // Fecha
    doc.text(`${texts.fecha} ${formatDate(factura.fecha)}`, margin, yPos);
    yPos += 15;

    // DE y PARA en dos columnas
    const leftX = margin;
    const rightX = margin + columnWidth + 20;
    const startY = yPos;

    // Columna izquierda: DE (emisor)
    doc.setFont('helvetica', 'bold');
    doc.text(texts.de, leftX, startY);
    let currentY = startY + 7;
    doc.setFont('helvetica', 'normal');
    if (factura.from) {
      const fromLines = doc.splitTextToSize(factura.from, columnWidth);
      doc.text(fromLines, leftX, currentY);
      currentY += fromLines.length * 7;
    } else {
      doc.text(texts.sinEspecificar, leftX, currentY);
      currentY += 7;
    }

    // Columna derecha: PARA (cliente)
    doc.setFont('helvetica', 'bold');
    doc.text(texts.para, rightX, startY);
    let currentYRight = startY + 7;
    doc.setFont('helvetica', 'normal');
    // Usar cliente completo si existe, sino usar establecimiento
    const clienteTexto = factura.cliente || factura.establecimiento || texts.sinEspecificar;
    const clienteLines = doc.splitTextToSize(clienteTexto, columnWidth);
    doc.text(clienteLines, rightX, currentYRight);
    currentYRight += clienteLines.length * 7;

    yPos = Math.max(currentY, currentYRight) + 10;

    // Tabla de items
    yPos += 5;
    const paddingTop = 10;
    const tableStartY = yPos - paddingTop;
    
    let tableHeight = paddingTop;
    tableHeight += 7; // Header
    const items = factura.items || [];
    items.forEach((item) => {
      const descLines = doc.splitTextToSize(item.descripcion || '', 80);
      tableHeight += Math.max(descLines.length * 5, 8);
    });
    tableHeight += 5;
    tableHeight += 7;
    tableHeight += 10;
    tableHeight += 7; // Subtotal
    tableHeight += 7; // IVA
    tableHeight += 7; // TOTAL
    
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(0, tableStartY, pageWidth, tableHeight, 0, 0, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(texts.descripcion, margin + 2, yPos);
    doc.text(texts.cantidad, margin + 100, yPos);
    doc.text(texts.precio, margin + 120, yPos);
    doc.text(texts.total, margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    doc.line(margin + 2, yPos, pageWidth - margin - 2, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    items.forEach((item, index) => {
      const descLines = doc.splitTextToSize(item.descripcion || '', 80);
      const itemHeight = Math.max(descLines.length * 5, 8);
      const itemTotal = item.cantidad * item.precio_unitario;
      
      if (index % 2 === 1) {
        doc.setFillColor(210, 210, 210);
        doc.rect(0, yPos - itemHeight + 2, pageWidth, itemHeight, 'F');
      }
      
      doc.text(descLines, margin + 2, yPos);
      doc.text(item.cantidad.toString(), margin + 100, yPos);
      doc.text(formatCurrencyPDF(item.precio_unitario), margin + 120, yPos);
      doc.text(formatCurrencyPDF(itemTotal), margin + 160, yPos, { align: 'right' });
      
      yPos += itemHeight;
    });

    yPos += 5;
    doc.line(margin + 2, yPos, pageWidth - margin - 2, yPos);
    yPos += 10;

    // Totales
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${texts.subtotal}`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrencyPDF(factura.subtotal), margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    // Mostrar porcentaje de VAT con decimales si es necesario
    const vatPercent = factura.tasa_iva ? (factura.tasa_iva * 100) : 0;
    const vatPercentStr = vatPercent % 1 === 0 ? vatPercent.toFixed(0) : vatPercent.toFixed(1);
    doc.text(`${texts.iva} (${vatPercentStr}%):`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrencyPDF(factura.iva), margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${texts.totalFinal}`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrencyPDF(factura.total), margin + 160, yPos, { align: 'right' });

    doc.save(`FACTURA-${numeroFactura}.pdf`);
  }

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
          Ingresar Factura
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

      {/* Facturas agrupadas por mes */}
      {groupedByMonth.length === 0 ? (
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
        <div className="space-y-4">
          {groupedByMonth.map((group) => (
            <div key={group.month} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden">
              {/* Month Header - Clickable */}
              <button
                onClick={() => toggleMonth(group.month)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Calendar className="text-emerald-400" size={20} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-white">{group.monthName}</h2>
                    <p className="text-slate-400 text-sm">{group.facturas.length} factura{group.facturas.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(group.total)}</p>
                    <p className="text-slate-400 text-sm">IVA: {formatCurrency(group.iva)}</p>
                  </div>
                  {expandedMonths.has(group.month) ? (
                    <ChevronDown className="text-slate-400" size={24} />
                  ) : (
                    <ChevronRight className="text-slate-400" size={24} />
                  )}
                </div>
              </button>
              
              {/* Month Content - Expandable */}
              {expandedMonths.has(group.month) && (
                <div className="border-t border-slate-700/50">
                  {group.facturas.map((factura, index) => (
                    <div
                      key={factura.id}
                      className={`px-6 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors group ${
                        index !== group.facturas.length - 1 ? 'border-b border-slate-700/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          factura.tipo === 'generada' 
                            ? 'bg-amber-500/20 text-amber-400' 
                            : 'bg-slate-700/50 text-slate-400'
                        }`}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{factura.establecimiento || 'Sin nombre'}</h3>
                          <p className="text-slate-500 text-sm">
                            {new Date(factura.fecha + 'T00:00:00').toLocaleDateString('es-ES', { 
                              weekday: 'short', 
                              day: 'numeric' 
                            })}
                            {factura.concepto && ` • ${factura.concepto}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{formatCurrency(factura.total)}</p>
                          <div className="flex gap-3 text-xs text-slate-500">
                            <span>Base: {formatCurrency(factura.subtotal)}</span>
                            <span>IVA: {formatCurrency(factura.iva)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {factura.fileUrl && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <FileViewer fileUrl={factura.fileUrl} fileName={factura.fileName} />
                            </div>
                          )}
                          {factura.tipo === 'generada' && (
                            <button
                              onClick={() => generatePDFFromFactura(factura)}
                              className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-amber-500/20 hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Descargar PDF"
                            >
                              <Download size={16} />
                            </button>
                          )}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              to={`/facturas/${factura.id}`}
                              className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                            >
                              <Edit size={16} />
                            </Link>
                            <button
                              onClick={() => handleDelete(factura.id)}
                              className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
