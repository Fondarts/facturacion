// i18n mínimo: t(key) traduce según el idioma elegido en Ajustes.
// Al cambiar el idioma, Settings recarga la página para re-renderizar todo.
import { getSettings } from './settings';

type Dict = Record<string, string>;

const es: Dict = {
  // Navegación / chrome
  'nav.home': 'Inicio',
  'nav.expenses': 'Gastos',
  'nav.stats': 'Estadísticas',
  'nav.invoice': 'Facturar',
  'nav.settings': 'Ajustes',
  'nav.signout': 'Cerrar sesión',
  // Común
  'common.save': 'Guardar',
  'common.saved': '✓ Guardado',
  'common.loading': 'Cargando…',
  // Login
  'login.subtitle': 'Iniciá sesión con tu cuenta de Google',
  'login.continue': 'Continuar con Google',
  'login.connecting': 'Conectando…',
  'login.error': 'No se pudo iniciar sesión con Google. Intentá nuevamente.',
  'login.note': 'Tus tickets se guardan en una carpeta de tu Google Drive (Facturación - Tickets). La app solo accede a los archivos que crea.',
  // Ajustes
  'settings.title': 'Ajustes',
  'settings.subtitle': 'Preferencias de la aplicación',
  'settings.language': 'Idioma',
  'settings.dateFormat': 'Formato de fecha por defecto',
  'settings.todayLooks': 'Hoy se vería:',
  'settings.geminiModel': 'Modelo de Gemini para el OCR',
  'settings.geminiHint': '"Automático" prueba el más económico y, si está saturado o sin cuota, pasa al siguiente.',
  'settings.reorgTitle': 'Imágenes en Drive',
  'settings.reorgDesc': 'Reordena las imágenes ya subidas en carpetas por año y mes según la fecha del ticket.',
  'settings.reorgBtn': 'Reorganizar imágenes',
  'settings.reorgRunning': 'Reorganizando…',
  'settings.reorgDone': 'Listo: {moved} de {total} movidas.',
  // Dashboard
  'dash.title': 'Dashboard',
  'dash.subtitle': 'Resumen de tus facturas y gastos',
  'dash.addExpense': 'Ingresar Gasto',
  'dash.totalExpenses': 'Total Gastos',
  'dash.totalSpent': 'Total Gastado',
  'dash.invoiced': 'Facturado',
  'dash.totalVat': 'Total IVA',
  'dash.recent': 'Gastos Recientes',
  'dash.generated': 'Facturas Generadas',
  'dash.generatedEmpty': 'No hay facturas generadas',
  'dash.viewAll': 'Ver todas',
  'dash.empty': 'No hay gastos todavía',
  'dash.addFirst': 'Añadir primer gasto',
  'dash.byMonth': 'Gastos por Mes',
  'dash.noName': 'Sin nombre',
  // Lista de gastos
  'list.title': 'Gastos',
  'list.count': '{n} gastos registrados',
  'list.search': 'Buscar por establecimiento o concepto...',
  'list.batch': 'Ingresar en Lote',
  'list.filterAll': 'Todas',
  'list.filterReceived': 'Recibidas',
  'list.filterIssued': 'Generadas',
  'list.emptyFiltered': 'No se encontraron gastos',
  'list.empty': 'No hay gastos todavía',
  // Visor de archivos
  'viewer.viewPdf': 'Ver PDF',
  'viewer.viewFile': 'Ver archivo',
};

const en: Dict = {
  'nav.home': 'Home',
  'nav.expenses': 'Expenses',
  'nav.stats': 'Statistics',
  'nav.invoice': 'Invoice',
  'nav.settings': 'Settings',
  'nav.signout': 'Sign out',
  'common.save': 'Save',
  'common.saved': '✓ Saved',
  'common.loading': 'Loading…',
  'login.subtitle': 'Sign in with your Google account',
  'login.continue': 'Continue with Google',
  'login.connecting': 'Connecting…',
  'login.error': 'Could not sign in with Google. Please try again.',
  'login.note': 'Your tickets are stored in a folder of your Google Drive (Facturación - Tickets). The app only accesses the files it creates.',
  'settings.title': 'Settings',
  'settings.subtitle': 'App preferences',
  'settings.language': 'Language',
  'settings.dateFormat': 'Default date format',
  'settings.todayLooks': 'Today would look like:',
  'settings.geminiModel': 'Gemini model for OCR',
  'settings.geminiHint': '"Automatic" tries the cheapest one and, if it is overloaded or out of quota, moves to the next.',
  'settings.reorgTitle': 'Images in Drive',
  'settings.reorgDesc': 'Reorganizes already-uploaded images into year/month folders based on the ticket date.',
  'settings.reorgBtn': 'Reorganize images',
  'settings.reorgRunning': 'Reorganizing…',
  'settings.reorgDone': 'Done: {moved} of {total} moved.',
  'dash.title': 'Dashboard',
  'dash.subtitle': 'Summary of your expenses',
  'dash.addExpense': 'Add expense',
  'dash.totalExpenses': 'Total expenses',
  'dash.totalSpent': 'Total spent',
  'dash.invoiced': 'Invoiced',
  'dash.totalVat': 'Total VAT',
  'dash.recent': 'Recent expenses',
  'dash.generated': 'Generated invoices',
  'dash.generatedEmpty': 'No generated invoices yet',
  'dash.viewAll': 'View all',
  'dash.empty': 'No expenses yet',
  'dash.addFirst': 'Add first expense',
  'dash.byMonth': 'Expenses by month',
  'dash.noName': 'No name',
  'list.title': 'Expenses',
  'list.count': '{n} expenses',
  'list.search': 'Search by merchant or description...',
  'list.batch': 'Batch',
  'list.filterAll': 'All',
  'list.filterReceived': 'Received',
  'list.filterIssued': 'Issued',
  'list.emptyFiltered': 'No expenses found',
  'list.empty': 'No expenses yet',
  'viewer.viewPdf': 'View PDF',
  'viewer.viewFile': 'View file',
};

const dicts: Record<string, Dict> = { es, en };

/** Traduce una clave; admite reemplazos {var}. Cae a español y luego a la clave. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = getSettings().language;
  let str = (dicts[lang] && dicts[lang][key]) || es[key] || key;
  if (vars) for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, String(vars[k]));
  return str;
}
