'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/supabase/client'
import Link from 'next/link'
import { ArrowRight, ShieldAlert } from 'lucide-react'

type EwiStatus = 'green' | 'yellow' | 'red'

const CFP_BUCKETS_SHORT = ['Тек.', '1–30', '31–90', '91–180', '181–365', '1–3г', '>3г']
const STATUS_DOT: Record<EwiStatus, string> = { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' }
const NORM_EMOJI: Record<EwiStatus, string> = { green: '🟢', yellow: '🟡', red: '🔴' }

function s11(v: number): EwiStatus { return v >= 13 ? 'green' : v >= 12 ? 'yellow' : 'red' }
function sk21(v: number): EwiStatus { return v >= 35 ? 'green' : v >= 30 ? 'yellow' : 'red' }

interface CfpRow {
  report_name: string
  created_at: string
  car11: number | null
  k21: number | null
  cfp_results: { buckets: { status: EwiStatus }[] } | null
}

export default function CfpDashboardCard() {
  const [latest,  setLatest]  = useState<CfpRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('cfp_reports')
      .select('report_name, created_at, car11, k21, cfp_results')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setLatest(data); setLoading(false) })
  }, [])

  const worstBucket = latest?.cfp_results?.buckets?.some(b => b.status === 'red')
    ? 'red' : latest?.cfp_results?.buckets?.some(b => b.status === 'yellow')
    ? 'yellow' : 'green'

  return (
    <Link href="/liquidity/cfp" className="group block bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
          <ShieldAlert className="w-4 h-4 text-cyan-600" />
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1B8A4C] transition-colors" />
      </div>
      <h3 className="font-semibold text-gray-900 text-sm mb-0.5">CFP — План финансирования</h3>

      {loading ? (
        <p className="text-[11px] text-gray-400 mb-2">Загрузка...</p>
      ) : !latest ? (
        <p className="text-[11px] text-gray-400 mb-2">Нет планов · Создать первый CFP</p>
      ) : (
        <>
          <p className="text-[11px] text-gray-400 mb-2 truncate">
            {latest.report_name} · {new Date(latest.created_at).toLocaleDateString('ru-RU')}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {latest.car11 != null && (
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium">
                CAR {NORM_EMOJI[s11(latest.car11)]}
              </span>
            )}
            {latest.k21 != null && (
              <span className="text-[10px] bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium">
                К2-1 {NORM_EMOJI[sk21(latest.k21)]}
              </span>
            )}
            {latest.cfp_results?.buckets && (
              <div className="flex items-center gap-0.5 ml-0.5" title={`Худший статус корзины: ${worstBucket === 'red' ? 'Дефицит' : worstBucket === 'yellow' ? 'Внимание' : 'Профицит'}`}>
                {latest.cfp_results.buckets.map((b, i) => (
                  <div key={i} title={CFP_BUCKETS_SHORT[i]}
                    className={`w-2.5 h-4 rounded-sm ${STATUS_DOT[b.status]}`} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Link>
  )
}
