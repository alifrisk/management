# Risk Management Platform — ОАО «Алиф Банк»

Платформа управления рисками для Службы управления рисками (СУР).

## Технический стек
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **AI**: Anthropic Claude API
- **Деплой**: Vercel

## Настройка (Sprint 0)

### 1. Supabase
1. Создать проект на supabase.com
2. Выполнить `supabase/schema.sql` в SQL Editor
3. Скопировать URL и anon key в `.env.local`

### 2. Переменные окружения
```bash
cp .env.local.example .env.local
# Заполнить все значения
```

### 3. Запуск
```bash
npm install
npm run dev
```

### 4. Первый администратор
После регистрации выполнить в Supabase SQL Editor:
```sql
UPDATE public.user_profiles 
SET role = 'admin', 
    full_name = 'Ваше ФИО',
    department = 'Служба управления рисками',
    position = 'Руководитель/Аналитик СУР'
WHERE email = 'ваш@alifbank.tj';
```

## Структура проекта
```
app/
  auth/         — Вход, регистрация, сброс пароля
  dashboard/    — Главная страница
  operational-risk/ — Операционный риск
  credit-risk/  — Кредитный риск
  market-risk/  — Рыночный риск
  liquidity/    — Ликвидность
  incident-form/ — Анкета для риск-координаторов
  admin/        — Администрирование

components/
  layout/       — Sidebar, Header
  
lib/
  constants.ts  — Все выпадающие списки
  utils.ts      — Вспомогательные функции

supabase/
  schema.sql    — Схема базы данных
  client.ts     — Клиент для браузера
  server.ts     — Клиент для сервера

types/
  index.ts      — TypeScript типы
```

## Роли пользователей
- **admin** — сотрудники СУР, полный доступ
- **user** — риск-координаторы других отделов, только анкета
