// Preferencias de la app (persisten en localStorage del navegador).

export type Language = 'es' | 'en';
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

export interface AppSettings {
  language: Language;
  dateFormat: DateFormat;
  geminiModel: string; // '' = automático (usa la lista del backend con fallback)
}

const KEY = 'facturacion_settings';

const DEFAULTS: AppSettings = {
  language: 'es',
  dateFormat: 'DD/MM/YYYY',
  geminiModel: '',
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    if (typeof document !== 'undefined') document.documentElement.lang = s.language;
  } catch {
    /* ignore */
  }
}

/** Formatea una fecha ('YYYY-MM-DD' o Date) según el formato elegido en Settings. */
export function formatDate(date: string | Date, fmt: DateFormat = getSettings().dateFormat): string {
  const d =
    typeof date === 'string'
      ? new Date(date.length <= 10 ? `${date}T00:00:00` : date)
      : date;
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  switch (fmt) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD/MM/YYYY':
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/AAAA (31/12/2025)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/AAAA (12/31/2025)' },
  { value: 'YYYY-MM-DD', label: 'AAAA-MM-DD (2025-12-31)' },
];

// Modelos de Gemini ofrecidos. '' deja que el backend elija (lista free-tier con fallback).
export const GEMINI_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Automático (recomendado)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (más económico)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (más preciso)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];
