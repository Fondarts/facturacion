import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, CalendarRange, Receipt, Hash, TrendingUp, TrendingDown, Plus, BarChart3 } from 'lucide-react';
import { getFacturas } from '../api';
import { Factura } from '../types';
import { getSettings } from '../settings';
import { t } from '../i18n';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);

const formatCurrencyShort = (value: number) => {
  const v = value || 0;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 100) / 10}k €`;
  return `${Math.round(v)} €`;
};

// --- Categorías: colores fijos para las conocidas + paleta para texto libre ---
const KNOWN_KEYS: Record<string, string> = {
  comida: 'Comida',
  transporte: 'Transporte',
  oficina: 'Oficina',
  servicios: 'Servicios',
  suministros: 'Suministros',
  otros: 'Otros',
};
const KNOWN_COLORS: Record<string, string> = {
  Comida: '#10b981',
  Transporte: '#38bdf8',
  Oficina: '#a78bfa',
  Servicios: '#f59e0b',
  Suministros: '#f43f5e',
  Otros: '#94a3b8',
};
const PALETTE = ['#2dd4bf', '#60a5fa', '#c084fc', '#fb923c', '#fb7185', '#a3e635', '#22d3ee', '#facc15'];

const norm = (s: string) =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function categoryOf(f: Factura): string {
  const raw = (f.categoria || f.concepto || '').trim();
  const n = norm(raw);
  if (KNOWN_KEYS[n]) return KNOWN_KEYS[n];
  if (!raw) return 'Otros';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function catLabel(cat: string): string {
  const n = norm(cat);
  return KNOWN_KEYS[n] ? t(`stats.cat.${n}`) : cat;
}

const monthKey = (fecha: string) => (fecha || '').substring(0, 7);

function locale() {
  return getSettings().language === 'en' ? 'en-US' : 'es-ES';
}
function shortMonth(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString(locale(), { month: 'short' }).replace('.', '');
}

interface MonthPoint {
  key: string;
  label: string;
  value: number;
  isCurrent: boolean;
}

export default function Stats() {
  const [facturas, setFacturas] = useState<Factura[] | null>(null);

  useEffect(() => {
    getFacturas()
      .then(setFacturas)
      .catch((e) => {
        console.error('Error cargando estadísticas:', e);
        setFacturas([]);
      });
  }, []);

  const data = useMemo(() => {
    if (!facturas) return null;
    const recibidas = facturas.filter((f) => f.tipo === 'recibida');

    const total = recibidas.reduce((s, f) => s + (f.total || 0), 0);
    const totalIva = recibidas.reduce((s, f) => s + (f.iva || 0), 0);
    const count = recibidas.length;
    const avgTicket = count > 0 ? total / count : 0;

    // Totales por mes
    const monthMap = new Map<string, number>();
    recibidas.forEach((f) => {
      const k = monthKey(f.fecha);
      if (k) monthMap.set(k, (monthMap.get(k) || 0) + (f.total || 0));
    });
    const monthlyAvg = monthMap.size > 0 ? total / monthMap.size : 0;

    // Serie de los últimos 12 meses (rellenando huecos con 0)
    const now = new Date();
    const series: MonthPoint[] = [];
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      series.push({
        key,
        label: shortMonth(d.getFullYear(), d.getMonth()),
        value: monthMap.get(key) || 0,
        isCurrent: key === curKey,
      });
    }

    // Mes actual vs anterior
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = monthMap.get(curKey) || 0;
    const lastMonth = monthMap.get(prevKey) || 0;
    const pctChange =
      lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : thisMonth > 0 ? 100 : 0;

    // Por categoría
    const catMap = new Map<string, number>();
    recibidas.forEach((f) => {
      const c = categoryOf(f);
      catMap.set(c, (catMap.get(c) || 0) + (f.total || 0));
    });
    let cats = Array.from(catMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    // Top 8 + resto en "Otros"
    if (cats.length > 8) {
      const head = cats.slice(0, 7);
      const restTotal = cats.slice(7).reduce((s, c) => s + c.value, 0);
      const otros = head.find((c) => norm(c.label) === 'otros');
      if (otros) otros.value += restTotal;
      else head.push({ label: 'Otros', value: restTotal });
      cats = head.sort((a, b) => b.value - a.value);
    }
    let paletteIdx = 0;
    const categories = cats.map((c) => ({
      ...c,
      color: KNOWN_COLORS[c.label] || PALETTE[paletteIdx++ % PALETTE.length],
    }));

    // Top comercios
    const merchMap = new Map<string, number>();
    recibidas.forEach((f) => {
      const name = (f.establecimiento || '').trim() || t('dash.noName');
      merchMap.set(name, (merchMap.get(name) || 0) + (f.total || 0));
    });
    const topMerchants = Array.from(merchMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return {
      total,
      totalIva,
      count,
      avgTicket,
      monthlyAvg,
      series,
      thisMonth,
      lastMonth,
      pctChange,
      categories,
      topMerchants,
    };
  }, [facturas]);

  if (!facturas || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (data.count === 0) {
    return (
      <div className="space-y-8">
        <Header />
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-12 border border-slate-700/50 text-center">
          <BarChart3 className="mx-auto text-slate-600 mb-4" size={48} />
          <p className="text-slate-400 mb-4">{t('stats.empty')}</p>
          <Link
            to="/facturas/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            <Plus size={18} />
            {t('dash.addExpense')}
          </Link>
        </div>
      </div>
    );
  }

  const up = data.pctChange >= 0;

  return (
    <div className="space-y-8">
      <Header />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard
          icon={<Wallet size={22} />}
          color="emerald"
          label={t('stats.totalSpent')}
          value={formatCurrency(data.total)}
        />
        <KpiCard
          icon={up ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          color={up ? 'rose' : 'emerald'}
          label={t('stats.thisMonth')}
          value={formatCurrency(data.thisMonth)}
          badge={`${up ? '▲' : '▼'} ${Math.abs(Math.round(data.pctChange))}% ${t('stats.vsPrev')}`}
          badgeColor={up ? 'rose' : 'emerald'}
        />
        <KpiCard
          icon={<CalendarRange size={22} />}
          color="sky"
          label={t('stats.monthlyAvg')}
          value={formatCurrency(data.monthlyAvg)}
        />
        <KpiCard
          icon={<Receipt size={22} />}
          color="violet"
          label={t('stats.avgTicket')}
          value={formatCurrency(data.avgTicket)}
        />
      </div>

      {/* Evolución (línea) + categorías (torta) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <Panel title={t('stats.trend')} subtitle={t('stats.last12')} className="lg:col-span-2">
          <SpendTrend data={data.series} />
        </Panel>
        <Panel title={t('stats.byCategory')}>
          <CategoryDonut data={data.categories} total={data.total} />
        </Panel>
      </div>

      {/* Comparación mensual (barras) + top comercios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <Panel title={t('stats.monthlyComparison')} subtitle={t('stats.last12')} className="lg:col-span-2">
          <MonthlyBars data={data.series} />
        </Panel>
        <Panel title={t('stats.topMerchants')}>
          <TopMerchants data={data.topMerchants} max={data.topMerchants[0]?.value || 1} />
        </Panel>
      </div>

      {/* Tira final: IVA total + nº de gastos */}
      <div className="grid grid-cols-2 gap-4 md:gap-6">
        <KpiCard icon={<Receipt size={22} />} color="amber" label={t('stats.totalVat')} value={formatCurrency(data.totalIva)} />
        <KpiCard icon={<Hash size={22} />} color="teal" label={t('stats.count')} value={String(data.count)} />
      </div>
    </div>
  );
}

// ============================ Sub-componentes ============================

function Header() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">{t('stats.title')}</h1>
      <p className="text-slate-400">{t('stats.subtitle')}</p>
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  rose: { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  sky: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
  violet: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  teal: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
};

function KpiCard({
  icon,
  color,
  label,
  value,
  badge,
  badgeColor,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.emerald;
  const bc = badgeColor ? COLOR_MAP[badgeColor] || COLOR_MAP.emerald : null;
  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-5 border border-slate-700/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-slate-400 text-xs">{label}</p>
          <p className="text-xl font-bold text-white truncate">{value}</p>
        </div>
      </div>
      {badge && bc && <p className={`mt-2 text-xs font-medium ${bc.text}`}>{badge}</p>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm flex flex-col ${className}`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Gráfico de área/línea con la evolución mensual del gasto. */
function SpendTrend({ data }: { data: MonthPoint[] }) {
  const W = 640;
  const H = 240;
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const x = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPts = `${pad.l},${pad.t + innerH} ${linePts} ${x(n - 1)},${pad.t + innerH}`;
  const gridVals = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      <defs>
        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid + etiquetas Y */}
      {gridVals.map((g) => {
        const yy = pad.t + innerH - g * innerH;
        return (
          <g key={g}>
            <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke="#334155" strokeWidth="1" strokeDasharray="3 4" />
            <text x={pad.l - 8} y={yy + 3} textAnchor="end" fontSize="10" fill="#64748b">
              {formatCurrencyShort(g * max)}
            </text>
          </g>
        );
      })}
      {/* Área + línea */}
      <polygon points={areaPts} fill="url(#spendGrad)" />
      <polyline points={linePts} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Puntos + etiquetas X */}
      {data.map((d, i) => (
        <g key={d.key}>
          <circle cx={x(i)} cy={y(d.value)} r={d.isCurrent ? 4.5 : 3} fill={d.isCurrent ? '#34d399' : '#10b981'} stroke="#0f172a" strokeWidth="1.5">
            <title>{`${d.label}: ${formatCurrency(d.value)}`}</title>
          </circle>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={d.isCurrent ? '#34d399' : '#64748b'}>
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Dona de gasto por categoría con leyenda. */
function CategoryDonut({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const r = 62;
  const cx = 80;
  const cy = 80;
  const sw = 26;
  const c = 2 * Math.PI * r;
  const sum = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={sw} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {data.map((d) => {
            const len = (d.value / sum) * c;
            const seg = (
              <circle
                key={d.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={sw}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
              >
                <title>{`${catLabel(d.label)}: ${formatCurrency(d.value)} (${Math.round((d.value / sum) * 100)}%)`}</title>
              </circle>
            );
            acc += len;
            return seg;
          })}
        </g>
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="#f1f5f9">
          {formatCurrencyShort(total)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#64748b">
          {t('stats.totalSpent')}
        </text>
      </svg>
      <div className="w-full space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-slate-300 truncate flex-1">{catLabel(d.label)}</span>
            <span className="text-slate-500 text-xs">{Math.round((d.value / sum) * 100)}%</span>
            <span className="text-slate-200 font-medium w-20 text-right">{formatCurrency(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barras verticales: comparación mes a mes (últimos 12 meses). */
function MonthlyBars({ data }: { data: MonthPoint[] }) {
  const W = 640;
  const H = 240;
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const slot = innerW / n;
  const bw = Math.min(34, slot * 0.62);
  const gridVals = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {gridVals.map((g) => {
        const yy = pad.t + innerH - g * innerH;
        return (
          <g key={g}>
            <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke="#334155" strokeWidth="1" strokeDasharray="3 4" />
            <text x={pad.l - 8} y={yy + 3} textAnchor="end" fontSize="10" fill="#64748b">
              {formatCurrencyShort(g * max)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const bx = pad.l + i * slot + (slot - bw) / 2;
        const by = pad.t + innerH - h;
        return (
          <g key={d.key}>
            <rect x={bx} y={by} width={bw} height={Math.max(0, h)} rx="4" fill={d.isCurrent ? '#34d399' : '#0ea5a3'}>
              <title>{`${d.label}: ${formatCurrency(d.value)}`}</title>
            </rect>
            <text x={bx + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={d.isCurrent ? '#34d399' : '#64748b'}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Top comercios como barras horizontales. */
function TopMerchants({ data, max }: { data: { name: string; value: number }[]; max: number }) {
  if (data.length === 0) return <p className="text-slate-500 text-sm">{t('stats.noData')}</p>;
  return (
    <div className="space-y-3">
      {data.map((m) => (
        <div key={m.name}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-300 truncate pr-2">{m.name}</span>
            <span className="text-slate-200 font-medium shrink-0">{formatCurrency(m.value)}</span>
          </div>
          <div className="bg-slate-700/30 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
              style={{ width: `${Math.max(4, (m.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
