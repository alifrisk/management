'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus, Clock, Edit2, Check, X } from 'lucide-react'
import { supabase } from '@/supabase/client'

interface Indicator {
  id: string
  label: string
  rate: number | null
  change: number | null
  change7d?: number | null
  unit: string
}

interface IndicatorsData {
  updatedAt: string
  currencies:  Indicator[]
  crypto:      Indicator[]
  commodities: Indicator[]
  macro:       (Indicator & { year?: string })[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtRate = (n: number | null, unit: string) => {
  if (n === null) return '—'
  if (unit === 'USD') return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  if (unit.startsWith('USD/')) return n.toFixed(unit === 'USD/EUR' ? 4 : 2)
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)
}

const changeColor = (c: number | null) => {
  if (c === null) return 'text-gray-400'
  if (c > 0) return 'text-green-600'
  if (c < 0) return 'text-red-600'
  return 'text-gray-500'
}

const changeBg = (c: number | null) => {
  if (c === null) return 'bg-gray-50'
  if (c > 1) return 'bg-green-50'
  if (c < -1) return 'bg-red-50'
  return 'bg-gray-50'
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ item }: { item: Indicator }) {
  const isPos = item.change !== null && item.change > 0
  const isNeg = item.change !== null && item.change < 0
  return (
    <div className={`rounded-xl border border-gray-100 p-4 shadow-sm ${changeBg(item.change)}`}>
      <p className="text-xs font-medium text-gray-500 mb-2 truncate">{item.label}</p>
      <p className="text-xl font-bold text-gray-900 mb-1">
        {item.rate !== null ? fmtRate(item.rate, item.unit) : '—'}
        <span className="text-xs font-normal text-gray-400 ml-1">{item.unit}</span>
      </p>
      <div className="flex flex-col gap-0.5">
        {item.change7d !== undefined ? (
          <>
            <div className={`flex items-center gap-1 text-xs font-semibold ${changeColor(item.change)}`}>
              {item.change != null && item.change > 0 ? <TrendingUp className="w-3 h-3"/> : item.change != null && item.change < 0 ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
              <span>{item.change != null ? `${item.change > 0 ? '+' : ''}${item.change}%` : '—'}</span>
              <span className="font-normal text-gray-400">24ч</span>
            </div>
            <div className={`flex items-center gap-1 text-xs font-semibold ${changeColor(item.change7d ?? null)}`}>
              {item.change7d != null && item.change7d > 0 ? <TrendingUp className="w-3 h-3"/> : item.change7d != null && item.change7d < 0 ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
              <span>{item.change7d != null ? `${item.change7d > 0 ? '+' : ''}${item.change7d}%` : '—'}</span>
              <span className="font-normal text-gray-400">7д</span>
            </div>
          </>
        ) : (
          <div className={`flex items-center gap-1 text-xs font-semibold ${changeColor(item.change)}`}>
            {item.change != null && item.change > 0 ? <TrendingUp className="w-3 h-3"/> : item.change != null && item.change < 0 ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
            <span>{item.change != null ? `${item.change > 0 ? '+' : ''}${item.change}%` : '—'}</span>
            <span className="font-normal text-gray-400">24ч</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, icon, items }: { title: string; icon: string; items: Indicator[] }) {
  if (!items.length) return null
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span className="text-base">{icon}</span> {title}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {items.map(item => <Card key={item.id} item={item} />)}
      </div>
    </div>
  )
}

interface MacroItem { id: string; label: string; rate: number | null; change: number | null; unit: string; year: string; sort_order?: number }

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MarketIndicatorsPage() {
  const [data,     setData]     = useState<IndicatorsData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [lastFetch,setLastFetch]= useState<Date | null>(null)
  const [fetchCount, setFetchCount] = useState(0)
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [editMacro, setEditMacro] = useState<MacroItem[] | null>(null)
  const [saving,   setSaving]   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/market-risk/indicators', { cache: 'no-store' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setLastFetch(new Date())
      setFetchCount(c => c + 1)
    } catch (e: unknown) {
      setError('Ошибка загрузки: ' + (e instanceof Error ? e.message : String(e)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setIsAdmin(data?.role === 'admin'))
    })
  }, [])

  async function startEdit() {
    const { data: rows } = await supabase.from('nbt_indicators').select('*').order('sort_order', { ascending: true })
    if (rows && rows.length > 0) {
      setEditMacro(rows)
    } else {
      // если таблица пустая, берём из загруженных данных
      setEditMacro((data?.macro || []).map((m, i) => ({ ...m, sort_order: i })) as MacroItem[])
    }
  }

  async function saveMacro() {
    if (!editMacro) return
    setSaving(true)
    for (const row of editMacro) {
      await supabase.from('nbt_indicators').upsert({
        id: row.id, label: row.label,
        rate: row.rate !== null && row.rate !== undefined ? Number(row.rate) : null,
        change: row.change !== null && row.change !== undefined ? Number(row.change) : null,
        unit: row.unit || '%', year: row.year || '',
        sort_order: row.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      })
    }
    setSaving(false)
    setEditMacro(null)
    fetchData()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Индикаторы рынка</h1>
          <p className="text-sm text-gray-500 mt-0.5">Валюты · Сырьё · Крипто · Обновление каждые 5 минут</p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetch && (
            <div key={fetchCount} className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              Обновлено: {lastFetch.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* Data */}
      {data && (
        <div className="space-y-6">
          <Section title="Валюты (к USD)" icon="💱" items={data.currencies} />
          <Section title="Сырьё" icon="🛢️" items={data.commodities as Indicator[]} />
          <Section title="Криптовалюты" icon="₿" items={data.crypto} />
          {data.macro?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span className="text-base">🇹🇯</span> Макроэкономика Таджикистана
                  <span className="text-[10px] text-gray-400 font-normal">· Источник: nbt.tj</span>
                </h2>
                {isAdmin && !editMacro && (
                  <button onClick={startEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Edit2 className="w-3 h-3" /> Обновить данные НБТ
                  </button>
                )}
                {isAdmin && editMacro && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditMacro(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                      <X className="w-3 h-3" /> Отмена
                    </button>
                    <button onClick={saveMacro} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#1B8A4C] text-white rounded-lg hover:bg-[#177040] disabled:opacity-50">
                      <Check className="w-3 h-3" /> {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                )}
              </div>

              {/* Edit form */}
              {editMacro && (
                <div className="mb-4 p-4 border border-[#1B8A4C] rounded-xl bg-green-50 space-y-3">
                  <p className="text-xs text-gray-600 font-medium">Обновите показатели с сайта <a href="https://nbt.tj" target="_blank" className="text-[#1B8A4C] underline">nbt.tj</a> и нажмите «Сохранить»</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {editMacro.map((row, idx) => (
                      <div key={row.id} className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
                        <input value={row.label} onChange={e => setEditMacro(p => p!.map((r,i) => i===idx ? {...r, label: e.target.value} : r))}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]"
                          placeholder="Название" />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">Значение</p>
                            <input type="number" step="0.01" value={row.rate ?? ''} onChange={e => setEditMacro(p => p!.map((r,i) => i===idx ? {...r, rate: e.target.value === '' ? null : Number(e.target.value)} : r))}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]" placeholder="0.0" />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">Изм. п.п.</p>
                            <input type="number" step="0.01" value={row.change ?? ''} onChange={e => setEditMacro(p => p!.map((r,i) => i===idx ? {...r, change: e.target.value === '' ? null : Number(e.target.value)} : r))}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]" placeholder="±0.0" />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">Период</p>
                            <input value={row.year} onChange={e => setEditMacro(p => p!.map((r,i) => i===idx ? {...r, year: e.target.value} : r))}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#1B8A4C]" placeholder="май 2026" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {data.macro.map(item => (
                  <div key={item.id} className="rounded-xl border border-gray-100 p-4 shadow-sm bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 mb-2 truncate">{item.label}</p>
                    <p className="text-xl font-bold text-gray-900 mb-1">
                      {item.rate !== null ? item.rate : '—'}
                      <span className="text-xs font-normal text-gray-400 ml-1">{item.unit}</span>
                    </p>
                    {'year' in item && item.year && (
                      <p className="text-[10px] text-gray-400">{item.year}</p>
                    )}
                    {item.change !== null && (
                      <div className={`flex items-center gap-1 text-xs font-semibold mt-1 ${changeColor(item.change)}`}>
                        {item.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {item.change > 0 ? '+' : ''}{item.change} п.п.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info footer */}
      <div className="text-xs text-gray-400 flex items-center gap-4 flex-wrap">
        <span>Источники: CoinGecko · Yahoo Finance · fawazahmed0</span>
        <span>Данные носят информационный характер</span>
        {lastFetch && (
          <span>Данные от: {lastFetch.toLocaleString('ru-RU')}</span>
        )}
      </div>
    </div>
  )
}
