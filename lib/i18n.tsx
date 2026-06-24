'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Lang = 'ru' | 'tg' | 'en'

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  ru: {
    nav: {
      home:                   'Главная',
      operationalRisk:        'Операционный риск',
      incidentRegistry:       'Реестр инцидентов',
      externalIncidents:      'Внешние инциденты',
      analyticsDashboard:     'Дашборд аналитика',
      riskMapping:            'Картирование рисков',
      stressTest:             'Стресс-тест',
      creditRisk:             'Кредитный риск',
      smeConclusions:         'Заключения МСБ',
      borrowerRegistry:       'Реестр заёмщиков',
      marketRisk:             'Рыночный риск',
      financialAnalysis:      'Фин. анализ контрагента',
      counterpartyAssessment: 'Оценка контрагентов',
      counterpartyRegistry:   'Реестр контрагентов',
      marketIndicators:       'Индикаторы рынка',
      liquidity:              'Ликвидность',
      cfpPlan:                'CFP — План финансирования',
      gapAnalysis:            'ГЭП-анализ ликвидности',
      vnd:                    'ВНД СУР',
      documents:              'Документы',
      recommendations:        'Реестр рекомендаций',
      recommendationsList:    'Рекомендации',
      tasks:                  'Задачи СУР',
      aiAgent:                'Рисковик AI',
      admin:                  'Администрирование',
      users:                  'Пользователи',
      settings:               'Настройки',
    },
    roles: {
      admin:       'Администратор',
      observer:    'Наблюдатель',
      coordinator: 'Риск-координатор',
      user:        'Пользователь',
    },
    logout: {
      title:       'Выйти из системы?',
      description: 'Вы уверены что хотите выйти?',
      cancel:      'Отмена',
      confirm:     'Выйти',
    },
    theme: {
      light: 'Светлая тема',
      dark:  'Тёмная тема',
    },
    lang: {
      ru: 'Русский',
      tg: 'Тоҷикӣ',
      en: 'English',
    },
  },

  tg: {
    nav: {
      home:                   'Асосӣ',
      operationalRisk:        'Хавфи амалиётӣ',
      incidentRegistry:       'Феҳристи инцидентҳо',
      externalIncidents:      'Инцидентҳои берунӣ',
      analyticsDashboard:     'Дашборди таҳлилӣ',
      riskMapping:            'Харитабандии хавфҳо',
      stressTest:             'Стресс-санҷиш',
      creditRisk:             'Хавфи қарзӣ',
      smeConclusions:         'Хулосаҳои КМК',
      borrowerRegistry:       'Феҳристи қарздорон',
      marketRisk:             'Хавфи бозорӣ',
      financialAnalysis:      'Таҳлили молиявии контрагент',
      counterpartyAssessment: 'Арзёбии контрагентон',
      counterpartyRegistry:   'Феҳристи контрагентон',
      marketIndicators:       'Нишондиҳандаҳои бозор',
      liquidity:              'Пардохтпазирӣ',
      cfpPlan:                'CFP — Нақшаи маблағгузорӣ',
      gapAnalysis:            'Таҳлили ГЭП',
      vnd:                    'ВНД ХИХ',
      documents:              'Ҳуҷҷатҳо',
      recommendations:        'Феҳристи тавсияҳо',
      recommendationsList:    'Тавсияҳо',
      tasks:                  'Вазифаҳои ХИХ',
      aiAgent:                'Таҳлилгари хавф AI',
      admin:                  'Маъмурияткунӣ',
      users:                  'Корбарон',
      settings:               'Танзимот',
    },
    roles: {
      admin:       'Маъмур',
      observer:    'Мушоҳидагар',
      coordinator: 'Ҳамоҳангсози хавф',
      user:        'Корбар',
    },
    logout: {
      title:       'Аз система баромадан?',
      description: 'Шумо мутмаин ҳастед, ки мехоҳед баромад?',
      cancel:      'Бекор кардан',
      confirm:     'Баромадан',
    },
    theme: {
      light: 'Мавзӯи равшан',
      dark:  'Мавзӯи торик',
    },
    lang: {
      ru: 'Русӣ',
      tg: 'Тоҷикӣ',
      en: 'Англисӣ',
    },
  },

  en: {
    nav: {
      home:                   'Home',
      operationalRisk:        'Operational Risk',
      incidentRegistry:       'Incident Registry',
      externalIncidents:      'External Incidents',
      analyticsDashboard:     'Analytics Dashboard',
      riskMapping:            'Risk Mapping',
      stressTest:             'Stress Test',
      creditRisk:             'Credit Risk',
      smeConclusions:         'SME Conclusions',
      borrowerRegistry:       'Borrower Registry',
      marketRisk:             'Market Risk',
      financialAnalysis:      'Counterparty Financial Analysis',
      counterpartyAssessment: 'Counterparty Assessment',
      counterpartyRegistry:   'Counterparty Registry',
      marketIndicators:       'Market Indicators',
      liquidity:              'Liquidity',
      cfpPlan:                'CFP — Contingency Funding Plan',
      gapAnalysis:            'Liquidity GAP Analysis',
      vnd:                    'IND RMD',
      documents:              'Documents',
      recommendations:        'Recommendations Registry',
      recommendationsList:    'Recommendations',
      tasks:                  'RMD Tasks',
      aiAgent:                'Risk AI',
      admin:                  'Administration',
      users:                  'Users',
      settings:               'Settings',
    },
    roles: {
      admin:       'Administrator',
      observer:    'Observer',
      coordinator: 'Risk Coordinator',
      user:        'User',
    },
    logout: {
      title:       'Sign out?',
      description: 'Are you sure you want to sign out?',
      cancel:      'Cancel',
      confirm:     'Sign out',
    },
    theme: {
      light: 'Light theme',
      dark:  'Dark theme',
    },
    lang: {
      ru: 'Russian',
      tg: 'Tajik',
      en: 'English',
    },
  },
} as const

// ── Types ─────────────────────────────────────────────────────────────────────
type Translations = typeof T.ru
type DeepKeys<T, Prefix extends string = ''> = T extends object
  ? { [K in keyof T]: K extends string
      ? T[K] extends object
        ? DeepKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`
      : never
    }[keyof T]
  : never
export type TranslationKey = DeepKeys<Translations>

// ── Context ───────────────────────────────────────────────────────────────────
interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'ru',
  setLang: () => {},
  t: (key) => key,
})

// ── Provider ──────────────────────────────────────────────────────────────────
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru')

  useEffect(() => {
    const saved = localStorage.getItem('alif-lang') as Lang | null
    if (saved && saved in T) setLangState(saved)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('alif-lang', l)
  }

  function t(key: TranslationKey): string {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = T[lang]
    for (const p of parts) {
      node = node?.[p]
      if (node === undefined) return key
    }
    return typeof node === 'string' ? node : key
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useI18n() {
  return useContext(I18nContext)
}
