import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Loader2, FileText, Download, User, Building2, ChevronDown } from 'lucide-react';
import { createFactura, getClientes, getEmisores, getUltimoCliente, getUltimoEmisor, saveCliente, saveEmisor, updateClienteUso, updateEmisorUso, deleteCliente, deleteEmisor, ClienteData, EmisorData } from '../api';
import { FacturaItem } from '../types';
import jsPDF from 'jspdf';

type Moneda = 'EUR' | 'USD' | 'GBP';
type FormatoFecha = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';
type Idioma = 'es' | 'en';

export default function Facturar() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [numeroFactura, setNumeroFactura] = useState<string>('');
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [emisores, setEmisores] = useState<EmisorData[]>([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showEmisorDropdown, setShowEmisorDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    from: '',
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    tasa_iva: 0,
    moneda: 'EUR' as Moneda,
    formatoFecha: 'DD/MM/YYYY' as FormatoFecha,
    idioma: 'es' as Idioma,
  });
  
  const [items, setItems] = useState<FacturaItem[]>([
    { descripcion: '', cantidad: 1, precio_unitario: 0 }
  ]);

  // Cargar datos iniciales
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Cargar configuración guardada
        const savedConfig = localStorage.getItem('facturar_config');
        if (savedConfig) {
          try {
            const config = JSON.parse(savedConfig);
            setFormData(prev => ({
              ...prev,
              moneda: config.moneda || prev.moneda,
              formatoFecha: config.formatoFecha || prev.formatoFecha,
              idioma: config.idioma || prev.idioma,
            }));
          } catch (e) {
            console.error('Error parsing saved config:', e);
          }
        }

        // Cargar clientes y emisores
        const [clientesList, emisoresList] = await Promise.all([
          getClientes(),
          getEmisores()
        ]);
        setClientes(clientesList);
        setEmisores(emisoresList);

        // Cargar últimos usados
        const [ultimoCliente, ultimoEmisor] = await Promise.all([
          getUltimoCliente(),
          getUltimoEmisor()
        ]);

        if (ultimoCliente) {
          setFormData(prev => ({ ...prev, cliente: ultimoCliente.datos }));
        }
        if (ultimoEmisor) {
          setFormData(prev => ({ ...prev, from: ultimoEmisor.datos }));
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    }
    loadInitialData();
  }, []);

  // Guardar configuración cuando cambie
  useEffect(() => {
    const config = {
      moneda: formData.moneda,
      formatoFecha: formData.formatoFecha,
      idioma: formData.idioma,
    };
    localStorage.setItem('facturar_config', JSON.stringify(config));
  }, [formData.moneda, formData.formatoFecha, formData.idioma]);

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

  async function selectCliente(cliente: ClienteData) {
    setFormData(prev => ({ ...prev, cliente: cliente.datos }));
    setShowClienteDropdown(false);
    if (cliente.id) {
      await updateClienteUso(cliente.id);
    }
  }

  async function selectEmisor(emisor: EmisorData) {
    setFormData(prev => ({ ...prev, from: emisor.datos }));
    setShowEmisorDropdown(false);
    if (emisor.id) {
      await updateEmisorUso(emisor.id);
    }
  }

  async function saveCurrentCliente() {
    if (!formData.cliente.trim()) return;
    const nombre = formData.cliente.split('\n')[0] || 'Cliente';
    await saveCliente({ nombre, datos: formData.cliente });
    const updated = await getClientes();
    setClientes(updated);
  }

  async function saveCurrentEmisor() {
    if (!formData.from.trim()) return;
    const nombre = formData.from.split('\n')[0] || 'Emisor';
    await saveEmisor({ nombre, datos: formData.from });
    const updated = await getEmisores();
    setEmisores(updated);
  }

  async function handleDeleteCliente(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) return;
    try {
      await deleteCliente(id);
      const updated = await getClientes();
      setClientes(updated);
    } catch (error) {
      console.error('Error deleting cliente:', error);
    }
  }

  async function handleDeleteEmisor(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que quieres eliminar este emisor?')) return;
    try {
      await deleteEmisor(id);
      const updated = await getEmisores();
      setEmisores(updated);
    } catch (error) {
      console.error('Error deleting emisor:', error);
    }
  }

  function formatDate(date: string): string {
    const d = new Date(date + 'T00:00:00');
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

  function formatCurrency(value: number): string {
    const currencyMap: Record<Moneda, string> = {
      EUR: 'EUR',
      USD: 'USD',
      GBP: 'GBP'
    };
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency: formData.moneda 
    }).format(value);
  }

  function getCurrencySymbol(): string {
    const symbols: Record<Moneda, string> = {
      EUR: '€',
      USD: '$',
      GBP: '£'
    };
    return symbols[formData.moneda];
  }

  function getTexts(idioma: Idioma) {
    if (idioma === 'en') {
      return {
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
      };
    }
    return {
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
  }

  function exportToPDF() {
    const doc = new jsPDF();
    const texts = getTexts(formData.idioma);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const columnWidth = (pageWidth - 2 * margin - 20) / 2; // Ancho de cada columna con espacio entre ellas
    let yPos = margin;

    // Título (alineado a la izquierda)
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(texts.factura, margin, yPos);
    yPos += 15;

    // Número de factura
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${texts.numeroFactura} ${numeroFactura || texts.sinNumero}`, margin, yPos);
    yPos += 10;

    // Fecha
    doc.text(`${texts.fecha} ${formatDate(formData.fecha)}`, margin, yPos);
    yPos += 15;

    // DE y PARA en dos columnas
    const leftX = margin;
    const rightX = margin + columnWidth + 20;
    const startY = yPos;

    // Columna izquierda: DE
    doc.setFont('helvetica', 'bold');
    doc.text(texts.de, leftX, startY);
    let currentY = startY + 7;
    doc.setFont('helvetica', 'normal');
    if (formData.from) {
      const fromLines = doc.splitTextToSize(formData.from, columnWidth);
      doc.text(fromLines, leftX, currentY);
      currentY += fromLines.length * 7;
    } else {
      doc.text(texts.sinEspecificar, leftX, currentY);
      currentY += 7;
    }

    // Columna derecha: PARA
    doc.setFont('helvetica', 'bold');
    doc.text(texts.para, rightX, startY);
    let currentYRight = startY + 7;
    doc.setFont('helvetica', 'normal');
    const clienteLines = doc.splitTextToSize(formData.cliente || texts.sinEspecificar, columnWidth);
    doc.text(clienteLines, rightX, currentYRight);
    currentYRight += clienteLines.length * 7;

    // Avanzar yPos al máximo de las dos columnas
    yPos = Math.max(currentY, currentYRight) + 10;

    // Tabla de items con fondo sombreado (incluyendo totales)
    yPos += 5;
    const paddingTop = 10; // Padding arriba (más espacio antes de DESCRIPTION)
    const tableStartY = yPos - paddingTop; // Empezar el fondo antes del texto
    
    // Calcular altura total de la tabla (items + totales)
    let tableHeight = paddingTop; // Padding arriba
    tableHeight += 7; // Header (DESCRIPTION, QTY, etc.)
    items.forEach((item) => {
      const descLines = doc.splitTextToSize(item.descripcion || '', 80);
      tableHeight += Math.max(descLines.length * 5, 8);
    });
    tableHeight += 5; // Espacio después de items
    tableHeight += 7; // Línea separadora
    tableHeight += 10; // Espacio antes de totales
    tableHeight += 7; // Subtotal
    tableHeight += 7; // IVA
    tableHeight += 7; // TOTAL
    // Sin padding abajo - corta justo después de TOTAL
    
    // Dibujar rectángulo sombreado de fondo primero (hasta los bordes laterales)
    doc.setFillColor(240, 240, 240); // Gris claro
    doc.roundedRect(0, tableStartY, pageWidth, tableHeight, 0, 0, 'F'); // Sin bordes redondeados, hasta los bordes
    
    // Headers (con padding interno)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); // Negro para el texto
    doc.text(texts.descripcion, margin + 2, yPos);
    doc.text(texts.cantidad, margin + 100, yPos);
    doc.text(texts.precio, margin + 120, yPos);
    doc.text(texts.total, margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    doc.line(margin + 2, yPos, pageWidth - margin - 2, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let itemYPos = yPos; // Guardar posición inicial de items
    items.forEach((item, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = margin;
        itemYPos = yPos;
      }
      
      const descLines = doc.splitTextToSize(item.descripcion || '', 80);
      const itemHeight = Math.max(descLines.length * 5, 8);
      
      // Dibujar fondo más oscuro para filas pares (índice 1, 3, 5...)
      if (index % 2 === 1) {
        doc.setFillColor(210, 210, 210); // Gris más oscuro que el fondo general
        doc.rect(0, yPos - itemHeight + 2, pageWidth, itemHeight, 'F');
      }
      
      const itemTotal = item.cantidad * item.precio_unitario;
      
      doc.text(descLines, margin + 2, yPos);
      doc.text(item.cantidad.toString(), margin + 100, yPos);
      doc.text(formatCurrency(item.precio_unitario), margin + 120, yPos);
      doc.text(formatCurrency(itemTotal), margin + 160, yPos, { align: 'right' });
      
      yPos += itemHeight;
    });

    yPos += 5;
    doc.line(margin + 2, yPos, pageWidth - margin - 2, yPos);
    yPos += 10;

    // Totales
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${texts.subtotal}`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrency(subtotal), margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    doc.text(`${texts.iva} (${formData.tasa_iva}%):`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrency(iva), margin + 160, yPos, { align: 'right' });
    yPos += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${texts.totalFinal}`, margin + 100, yPos, { align: 'right' });
    doc.text(formatCurrency(total), margin + 160, yPos, { align: 'right' });

    doc.save(`FACTURA-${numeroFactura || 'sin-numero'}.pdf`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Guardar cliente y emisor actuales si tienen datos
      if (formData.cliente.trim()) {
        await saveCurrentCliente();
      }
      if (formData.from.trim()) {
        await saveCurrentEmisor();
      }

      const data = new FormData();
      data.append('establecimiento', formData.cliente.split('\n')[0] || formData.cliente);
      data.append('fecha', formData.fecha);
      data.append('concepto', numeroFactura ? `Factura ${numeroFactura}` : 'Factura generada');
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
                onChange={(e) => setFormData({ ...formData, moneda: e.target.value as Moneda })}
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
                onChange={(e) => setFormData({ ...formData, formatoFecha: e.target.value as FormatoFecha })}
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
                onChange={(e) => setFormData({ ...formData, idioma: e.target.value as Idioma })}
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
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              required
            />
            <span className="text-xs text-slate-400 mt-1 block">Vista previa: {formatDate(formData.fecha)}</span>
          </div>
        </div>

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
            onChange={(e) => setFormData({ ...formData, from: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
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
