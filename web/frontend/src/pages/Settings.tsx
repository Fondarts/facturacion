import { useState } from 'react';
import { Settings as SettingsIcon, Check, Globe, Calendar, Cpu } from 'lucide-react';
import {
  getSettings,
  saveSettings,
  AppSettings,
  Language,
  DateFormat,
  LANGUAGE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  GEMINI_MODEL_OPTIONS,
  formatDate,
} from '../settings';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const selectClass =
    'w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all';

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <SettingsIcon className="text-emerald-400" size={22} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Ajustes</h1>
          <p className="text-slate-400">Preferencias de la aplicación</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm p-8 space-y-6">
        {/* Idioma */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
            <Globe size={16} className="text-emerald-400" /> Idioma
          </label>
          <select
            value={settings.language}
            onChange={(e) => update('language', e.target.value as Language)}
            className={selectClass}
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Formato de fecha */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
            <Calendar size={16} className="text-emerald-400" /> Formato de fecha por defecto
          </label>
          <select
            value={settings.dateFormat}
            onChange={(e) => update('dateFormat', e.target.value as DateFormat)}
            className={selectClass}
          >
            {DATE_FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">
            Hoy se vería: <span className="text-slate-300">{formatDate(new Date(), settings.dateFormat)}</span>
          </p>
        </div>

        {/* Modelo de Gemini */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
            <Cpu size={16} className="text-emerald-400" /> Modelo de Gemini para el OCR
          </label>
          <select
            value={settings.geminiModel}
            onChange={(e) => update('geminiModel', e.target.value)}
            className={selectClass}
          >
            {GEMINI_MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">
            "Automático" prueba el más económico y, si está saturado o sin cuota, pasa al siguiente.
          </p>
        </div>

        {/* Guardar */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-lg shadow-emerald-500/20"
          >
            <Check size={18} />
            Guardar
          </button>
          {saved && <span className="text-emerald-400 text-sm">✓ Guardado</span>}
        </div>
      </div>
    </div>
  );
}
