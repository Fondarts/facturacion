import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Trash2, FileText, Download, User, Building2, ChevronDown } from 'lucide-react';
import { getFactura, updateFactura, getClientes, getEmisores, getUltimoCliente, getUltimoEmisor, saveCliente, saveEmisor, updateClienteUso, updateEmisorUso, deleteCliente, deleteEmisor, ClienteData, EmisorData } from '../api';
import { Factura, FacturaItem } from '../types';
import FileViewer from '../components/FileViewer';
import jsPDF from 'jspdf';

type Moneda = 'EUR' | 'USD' | 'GBP';
type FormatoFecha = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';
type Idioma = 'es' | 'en';

export default function FacturaEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [factura, setFactura] = useState<Factura | null>(null);
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [emisores, setEmisores] = useState<EmisorData[]>([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showEmisorDropdown, setShowEmisorDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    from: '',
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    tasa_iva: 0,
    moneda: 'EUR' as Moneda,
    formatoFecha: 'DD/MM/YYYY' as FormatoFecha,
    idioma: 'es' as Idioma,
  });
  
  const [numeroFactura, setNumeroFactura] = useState<string>('');
  const [items, setItems] = useState<FacturaItem[]>([
    { descripcion: '', cantidad: 1, precio_unitario: 0 }
  ]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getFactura(id);
        setFactura(data);
        
        // Si es factura generada, cargar todos los campos
        if (data.tipo === 'generada') {
          setFormData({
            from: data.from || '',
            cliente: data.cliente || data.establecimiento || '',
            fecha: data.fecha || new Date().toISOString().split('T')[0],
            tasa_iva: (data.tasa_iva || 0) * 100,
            moneda: (data.moneda as Moneda) || 'EUR',
            formatoFecha: (data.formatoFecha as FormatoFecha) || 'DD/MM/YYYY',
            idioma: (data.idioma as Idioma) || 'es',
          });
          setNumeroFactura(data.numeroFactura || '');
          setItems(data.items || [{ descripcion: '', cantidad: 1, precio_unitario: 0 }]);
        }
        
        // Cargar clientes y emisores
        const [clientesList, emisoresList] = await Promise.all([
          getClientes(),
          getEmisores()
        ]);
        setClientes(clientesList);
        setEmisores(emisoresList);
      } catch (error) {
        console.error('Error loading factura:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowClienteDropdown(false);
        setShowEmisorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Funciones para clientes
  function selectCliente(cliente: ClienteData) {
    setFormData({ ...formData, cliente: cliente.datos });
    setShowClienteDropdown(false);
    if (cliente.id) {
      updateClienteUso(cliente.id);
    }
  }

  async function saveCurrentCliente() {
    if (!formData.cliente.trim()) return;
    const nombre = formData.cliente.split('\n')[0] || formData.cliente;
    try {
      await saveCliente({ nombre, datos: formData.cliente });
      const clientesList = await getClientes();
      setClientes(clientesList);
    } catch (error) {
      console.error('Error saving cliente:', error);
    }
  }

  async function handleDeleteCliente(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('¿Eliminar este cliente?')) {
      try {
        await deleteCliente(id);
        const clientesList = await getClientes();
        setClientes(clientesList);
      } catch (error) {
        console.error('Error deleting cliente:', error);
      }
    }
  }

  // Funciones para emisores
  function selectEmisor(emisor: EmisorData) {
    setFormData({ ...formData, from: emisor.datos });
    setShowEmisorDropdown(false);
    if (emisor.id) {
      updateEmisorUso(emisor.id);
    }
  }

  async function saveCurrentEmisor() {
    if (!formData.from.trim()) return;
    const nombre = formData.from.split('\n')[0] || formData.from;
    try {
      await saveEmisor({ nombre, datos: formData.from });
      const emisoresList = await getEmisores();
      setEmisores(emisoresList);
    } catch (error) {
      console.error('Error saving emisor:', error);
    }
  }

  async function handleDeleteEmisor(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('¿Eliminar este emisor?')) {
      try {
        await deleteEmisor(id);
        const emisoresList = await getEmisores();
        setEmisores(emisoresList);
      } catch (error) {
        console.error('Error deleting emisor:', error);
      }
    }
  }

  // Funciones para items
  function addItem() {
    setItems([...items, { descripcion: '', cantidad: 1, precio_unitario: 0 }]);
  }

  function updateItem(index: number, field: keyof FacturaItem, value: string | number) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  // Calcular totales
  const subtotal = items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  const iva = subtotal * (formData.tasa_iva / 100);
  const total = subtotal + iva;

  // Formatear moneda
  function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: formData.moneda 
    }).format(value);
  }

  // Formatear fecha
  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    switch (formData.formatoFecha) {
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
  }

  // Exportar a PDF
  function exportToPDF() {
    const doc = new jsPDF();
    const margin = 20;
    let yPos = margin;

    const texts = formData.idioma === 'en' ? {
      factura: 'INVOICE',
      numeroFactura: 'Invoice Number:',
      de: 'FROM:',
      para: 'TO:',
      fecha: 'Date:',
      descripcion: 'Description',
      cantidad: 'Qty',
      precio: 'Price',
      total: 'Total',
      subtotal: 'Subtotal',
      iva: 'VAT',
      totalFinal: 'TOTAL',
      sinEspecificar: 'Not specified'
    } : {
      factura: 'FACTURA',
      numeroFactura: 'Número de Factura:',
      de: 'DE:',
      para: 'PARA:',
      fecha: 'Fecha:',
      descripcion: 'Descripción',
      cantidad: 'Cantidad',
      precio: 'Precio',
      total: 'Total',
      subtotal: 'Subtotal',
      iva: 'IVA',
      totalFinal: 'TOTAL',
      sinEspecificar: 'Sin especificar'
    };

    // Título (alineado a la izquierda)
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(texts.factura, margin, yPos);
    yPos += 15;

    // Número de factura
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${texts.numeroFactura} ${numeroFactura || factura?.id.substring(0, 8)}`, margin, yPos);
    yPos += 10;

    // Fecha
    doc.text(`${texts.fecha} ${formatDate(formData.fecha)}`, margin, yPos);
    yPos += 15;

    // DE y PARA en dos columnas
    const leftX = margin;
    const rightX = margin + 90;
    const startY = yPos;

    // Columna izquierda: DE (emisor)
    doc.setFont('helvetica', 'bold');
    doc.text(texts.de, leftX, startY);
    let currentY = startY + 7;
    doc.setFont('helvetica', 'normal');
    if (formData.from) {
      const fromLines = doc.splitTextToSize(formData.from, 80);
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
    const clienteLines = doc.splitTextToSize(formData.cliente || texts.sinEspecificar, 80);
    doc.text(clienteLines, rightX, currentYRight);
    currentYRight += clienteLines.length * 7;

    yPos = Math.max(currentY, currentYRight) + 15;

    // Tabla de items con fondo sombreado
    const tableStartY = yPos + 10; // 10px padding superior
    const tableWidth = doc.internal.pageSize.getWidth() - (margin * 2);
    const headerY = tableStartY;
    
    // Fondo sombreado (rectángulo completo)
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, tableStartY - 10, tableWidth, 200, 'F'); // Alto suficiente para cubrir items y totales

    // Headers de tabla
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(texts.descripcion, margin + 5, headerY);
    doc.text(texts.cantidad, margin + 120, headerY);
    doc.text(texts.precio, margin + 145, headerY);
    doc.text(texts.total, margin + 170, headerY);
    
    yPos = headerY + 10;

    // Items con zebra striping
    items.forEach((item, index) => {
      if (!item.descripcion) return;
      
      const itemTotal = item.cantidad * item.precio_unitario;
      
      // Zebra striping (filas pares más oscuras)
      if (index % 2 === 1) {
        doc.setFillColor(230, 230, 230);
        doc.rect(margin, yPos - 5, tableWidth, 8, 'F');
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(item.descripcion, 100);
      doc.text(descLines, margin + 5, yPos);
      const descHeight = descLines.length * 5;
      
      doc.text(item.cantidad.toString(), margin + 120, yPos);
      doc.text(formatCurrency(item.precio_unitario), margin + 145, yPos);
      doc.text(formatCurrency(itemTotal), margin + 170, yPos);
      
      yPos += Math.max(descHeight, 8);
    });

    // Totales
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${texts.subtotal}:`, margin + 120, yPos);
    doc.text(formatCurrency(subtotal), margin + 170, yPos);
    yPos += 7;
    
    doc.text(`${texts.iva} (${formData.tasa_iva}%):`, margin + 120, yPos);
    doc.text(formatCurrency(iva), margin + 170, yPos);
    yPos += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${texts.totalFinal}:`, margin + 120, yPos);
    doc.text(formatCurrency(total), margin + 170, yPos);

    doc.save(`factura-${numeroFactura || factura?.id || 'nueva'}.pdf`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factura || !id) return;

    setSaving(true);
    try {
      if (factura.tipo === 'generada') {
        // Para facturas generadas, actualizar con todos los campos
        const updateData: Partial<Factura> = {
          establecimiento: formData.cliente.split('\n')[0] || formData.cliente,
          cliente: formData.cliente, // Guardar cliente completo
          fecha: formData.fecha,
          subtotal: subtotal,
          tasa_iva: formData.tasa_iva / 100,
          iva: iva,
          total: total,
          items: items,
          from: formData.from,
          moneda: formData.moneda,
          formatoFecha: formData.formatoFecha,
          idioma: formData.idioma,
          numeroFactura: numeroFactura,
        };
        await updateFactura(id, updateData);
      } else {
        // Para facturas recibidas, actualizar campos básicos
        const updateData: Partial<Factura> = {
          establecimiento: factura.establecimiento,
          fecha: factura.fecha,
          subtotal: factura.subtotal,
          tasa_iva: factura.tasa_iva,
          iva: factura.iva,
          total: factura.total,
        };
        await updateFactura(id, updateData);
      }
      navigate('/facturas');
    } catch (error) {
      console.error('Error updating factura:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: keyof typeof formData, value: string | number) {
    setFormData({ ...formData, [field]: value });
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

  // Si es factura generada, mostrar formulario completo como Facturar.tsx
  if (factura.tipo === 'generada') {
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
            <h1 className="text-2xl font-bold text-white">Editar Factura</h1>
            <p className="text-slate-400">Modifica los datos de tu factura</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Configuración */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText size={20} className="text-amber-400" />
              Configuración
            </h2>
            
            <div className="grid grid-cols-4 gap-4">
              {/* Número de factura */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Número de Factura
                </label>
                <input
                  type="text"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Ej: FAC-001, INV-2024-001, etc."
                />
              </div>

              {/* Moneda */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Moneda
                </label>
                <select
                  value={formData.moneda}
                  onChange={(e) => handleChange('moneda', e.target.value as Moneda)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              {/* Formato de fecha */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Formato Fecha
                </label>
                <select
                  value={formData.formatoFecha}
                  onChange={(e) => handleChange('formatoFecha', e.target.value as FormatoFecha)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                </select>
              </div>

              {/* Idioma */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Idioma
                </label>
                <select
                  value={formData.idioma}
                  onChange={(e) => handleChange('idioma', e.target.value as Idioma)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
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
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                required
              />
              <span className="text-xs text-slate-400 mt-1 block">Vista previa: {formatDate(formData.fecha)}</span>
            </div>
          </div>

          {/* From (Emisor) y Cliente en 2 columnas */}
          <div className="grid grid-cols-2 gap-4">
            {/* From (Emisor) */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Building2 size={20} className="text-amber-400" />
                  From (Emisor)
                </h2>
                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() => setShowEmisorDropdown(!showEmisorDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 transition-colors"
                  >
                    <User size={16} />
                    Elegir
                    <ChevronDown size={16} />
                  </button>
                  {showEmisorDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                      {emisores.length === 0 ? (
                        <div className="p-4 text-slate-400 text-sm">No hay emisores guardados</div>
                      ) : (
                        emisores.map((emisor) => (
                          <div
                            key={emisor.id}
                            className="flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0 group"
                          >
                            <button
                              type="button"
                              onClick={() => selectEmisor(emisor)}
                              className="flex-1 text-left"
                            >
                              <div className="font-medium text-white">{emisor.nombre}</div>
                              <div className="text-xs text-slate-400 mt-1 line-clamp-2">{emisor.datos}</div>
                            </button>
                            {emisor.id && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteEmisor(emisor.id!, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Eliminar emisor"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <textarea
                value={formData.from}
                onChange={(e) => handleChange('from', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-32 resize-y"
                placeholder="Tu nombre o empresa&#10;Dirección&#10;Ciudad, Código Postal&#10;Email: tu@email.com&#10;Teléfono: 123 456 789&#10;CIF/NIF: 12345678A"
                rows={6}
              />
              <button
                type="button"
                onClick={saveCurrentEmisor}
                disabled={!formData.from.trim()}
                className="text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar este emisor
              </button>
            </div>

            {/* Cliente */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <User size={20} className="text-amber-400" />
                  Cliente
                </h2>
                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 transition-colors"
                  >
                    <User size={16} />
                    Elegir
                    <ChevronDown size={16} />
                  </button>
                  {showClienteDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                      {clientes.length === 0 ? (
                        <div className="p-4 text-slate-400 text-sm">No hay clientes guardados</div>
                      ) : (
                        clientes.map((cliente) => (
                          <div
                            key={cliente.id}
                            className="flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0 group"
                          >
                            <button
                              type="button"
                              onClick={() => selectCliente(cliente)}
                              className="flex-1 text-left"
                            >
                              <div className="font-medium text-white">{cliente.nombre}</div>
                              <div className="text-xs text-slate-400 mt-1 line-clamp-2">{cliente.datos}</div>
                            </button>
                            {cliente.id && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCliente(cliente.id!, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Eliminar cliente"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <textarea
                value={formData.cliente}
                onChange={(e) => handleChange('cliente', e.target.value)}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-h-32 resize-y"
                placeholder="Nombre del cliente&#10;Dirección&#10;Ciudad, Código Postal&#10;Email: cliente@ejemplo.com&#10;Teléfono: 123 456 789"
                required
                rows={6}
              />
              <button
                type="button"
                onClick={saveCurrentCliente}
                disabled={!formData.cliente.trim()}
                className="text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar este cliente
              </button>
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
              <div className="grid grid-cols-12 gap-3 text-sm text-slate-400 px-1">
                <div className="col-span-6">Descripción</div>
                <div className="col-span-2 text-center">Cantidad</div>
                <div className="col-span-2 text-center">Precio</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>

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
                  onChange={(e) => handleChange('tasa_iva', parseFloat(e.target.value) || 0)}
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
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Si es factura recibida, mostrar formulario simple
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
              onChange={(e) => setFactura({ ...factura, establecimiento: e.target.value })}
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
              onChange={(e) => setFactura({ ...factura, fecha: e.target.value })}
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
              onChange={(e) => setFactura({ ...factura, concepto: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Descripción o concepto"
            />
          </div>

          {/* Archivo */}
          {factura.fileUrl && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Archivo de Factura
              </label>
              <FileViewer fileUrl={factura.fileUrl} fileName={factura.fileName} />
            </div>
          )}

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
                onChange={(e) => {
                  const subtotal = parseFloat(e.target.value) || 0;
                  const iva = subtotal * (factura.tasa_iva || 0.1);
                  setFactura({ ...factura, subtotal, iva, total: subtotal + iva });
                }}
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
                onChange={(e) => setFactura({ ...factura, total: parseFloat(e.target.value) || 0 })}
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
