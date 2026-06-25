'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/supabase/client'
import Link from 'next/link'
import { ArrowRight, GitMerge } from 'lucide-react'

type EwiStatus = 'green' | 'yellow' | 'red'

const BUCKETS_SHORT = ['Тек.', '1–30', '31–90', '91–180', '181–365', '1–3г', '>3г']
const STATUS_DOT: Record<EwiStatus, string> = { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' }

interface GapRow {
  analyst_name: string
  period_date: string
  created_at: string
  gap_results: { buckets: { status: EwiStatus }[] } | null
}

export default function GapDashboardCard() {
  const [latest,  setLatest]  = useState<GapRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('gap_analysis')
      .select('analyst_name, period_date, created_at, gap_results')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setLatest(data); setLoading(false) })
  }, [])

  const buckets = latest?.gap_results?.buckets || []
  const worstStatus: EwiStatus = buckets.some(b => b.status === 'red')
    ? 'red' : buckets.some(b => b.status === 'yellow') ? 'yellow' : 'green'
  const worstLabel = worstStatus === 'red' ? 'Дефицит' : worstStatus === 'yellow' ? 'Внимание' : 'Норма'

  const periodStr = latest?.period_date
    ? new Date(latest.period_date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    : null

  return (
    <Link href="/liquidity/gap" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
          <GitMerge className="w-4 h-4 text-teal-600" />
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
      </div>
      <h3 className="font-semibold text-gray-900 text-sm mb-0.5">ГЭП-анализ ликвидности</h3>

      {loading ? (
        <p className="text-[11px] text-gray-400 mb-2">Загрузка...</p>
      ) : !latest ? (
        <p className="text-[11px] text-gray-400 mb-2">Нет анализов · Создать первый</p>
      ) : (
        <>
          <p className="text-[11px] text-gray-400 mb-2 truncate">
            {periodStr || new Date(latest.created_at).toLocaleDateString('ru-RU')}
            {latest.analyst_name ? ` · ${latest.analyst_name}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {buckets.length > 0 && (
              <>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  worstStatus === 'red' ? 'bg-red-100 text-red-700' :
                  worstStatus === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-[#1B8A4C]'
                }`}>
                  {worstLabel}
                </span>
                <div className="flex items-center gap-0.5">
                  {buckets.map((b, i) => (
                    <div key={i} title={BUCKETS_SHORT[i]}
                      className={`w-2.5 h-4 rounded-sm ${STATUS_DOT[b.status]}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Link>
  )
}
