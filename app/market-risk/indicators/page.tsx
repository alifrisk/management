'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'

interface Indicator {
  id: string
  label: string
  rate: number | null
  change: number | null
  change7d?: number | null
  changeMtM?: number | null
  changeYtY?: number | null
  unit: string
  source?: string
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
  if (n < 1) return n.toFixed(4)
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)
}

const changeColor = (c: number | null | undefined) => {
  if (c == null) return 'text-gray-400'
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

const fmtChange = (val: number | null | undefined) =>
  val != null ? `${val > 0 ? '+' : ''}${val}%` : '—'

// ── Single change row ─────────────────────────────────────────────────────────
function ChangeRow({ val, label }: { val: number | null | undefined; label: string }) {
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${changeColor(val)}`}>
      {val != null && val > 0
        ? <TrendingUp className="w-3 h-3" />
        : val != null && val < 0
          ? <TrendingDown className="w-3 h-3" />
          : <Minus className="w-3 h-3" />}
      <span>{fmtChange(val)}</span>
      <span className="font-normal text-gray-400">{label}</span>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ item }: { item: Indicator }) {
  const hasHistory = item.change7d !== undefined

  return (
    <div className={`rounded-xl border border-gray-100 p-4 shadow-sm ${changeBg(item.change)}`}>
      <div className="flex items-start justify-between mb-2 gap-1">
        <p className="text-xs font-medium text-gray-500 truncate">{item.label}</p>
        {item.source === 'est' && (
          <span className="flex-shrink-0 text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 leading-tight" title="Оценка: Brent минус дисконт $15/bbl">≈est</span>
        )}
        {item.source === 'MOEX' && (
          <span className="flex-shrink-0 text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 leading-tight">MOEX</span>
        )}
      </div>

      <p className="text-xl font-bold text-gray-900 mb-2">
        {item.rate !== null ? fmtRate(item.rate, item.unit) : '—'}
        <span className="text-xs font-normal text-gray-400 ml-1">{item.unit}</span>
      </p>

      {hasHistory ? (
        /* 2×2 grid: [24ч | 7д] / [30д | 1г] */
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <ChangeRow val={item.change}    label="24ч" />
          <ChangeRow val={item.change7d}  label="7д"  />
          <ChangeRow val={item.changeMtM} label="30д" />
          <ChangeRow val={item.changeYtY} label="1г"  />
        </div>
      ) : (
        <ChangeRow val={item.change} label="24ч" />
      )}
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MarketIndicatorsPage() {
  const [data,      setData]      = useState<IndicatorsData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [fetchCount, setFetchCount] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/market-risk/indicators', { cache: 'no-store' })
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
            <div key={i} className="bg-gray-100 rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      )}

      {/* Data */}
      {data && (
        <div className="space-y-6">
          <Section title="Валюты (к USD)" icon="💱" items={data.currencies} />
          <Section title="Сырьё"          icon="🛢️" items={data.commodities as Indicator[]} />
          <Section title="Криптовалюты"   icon="₿"  items={data.crypto} />
        </div>
      )}

      {/* Info footer */}
      <div className="text-xs text-gray-400 flex items-center gap-4 flex-wrap">
        <span>Источники: Yahoo Finance · CoinGecko · fawazahmed0 · Urals: MOEX FORTS или ≈Brent−$15</span>
        <span>Данные носят информационный характер</span>
        {lastFetch && (
          <span>Данные от: {lastFetch.toLocaleString('ru-RU')}</span>
        )}
      </div>
    </div>
  )
}
