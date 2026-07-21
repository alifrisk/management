# Docker — Risk Management Platform (Alif Bank)

> Проект: **management** (Risk Management Platform / СУР Алиф Банк). Не путать с Qarzimon.

## Переменные окружения

Собрано сканированием всего кода на `process.env`. **Только названия — значения передаёт DevOps/владелец секретов отдельно.**

### Используются в коде (`process.env.*`)

| Переменная | Где используется | Обязательна |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase/server.ts`, `app/api/auth/login`, `app/api/create-user` | да |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase/server.ts`, `app/api/auth/login` | да |
| `SUPABASE_SERVICE_ROLE_KEY` | `app/api/auth/login`, `app/api/create-user` | да (серверный ключ, не светить в логах) |
| `ANTHROPIC_API_KEY` | `lib/ai-provider.ts`, `app/api/ai-agent`, `app/api/market-risk/generate` | да, если `AI_PROVIDER=claude` |
| `CLAUDE_MODEL` | `lib/ai-provider.ts`, `app/api/ai-agent` | нет (есть дефолт `claude-sonnet-4-6`) |
| `AI_PROVIDER` | `lib/ai-provider.ts` | нет (дефолт `claude`) |
| `GEMINI_API_KEY` | `lib/ai-provider.ts` | да, если `AI_PROVIDER=gemini` |
| `GEMINI_MODEL` | `lib/ai-provider.ts` | нет (есть дефолт `gemini-2.0-flash`) |
| `NEXT_PUBLIC_APP_URL` | `app/api/export/nbt-report/route.ts` | нет (есть дефолт) |

### Объявлены в `.env.local.example`, но пока не используются в коде

Пакет `nodemailer` установлен, но нигде не вызывается — вероятно, задел на будущее для email-уведомлений. Оставляю в списке на случай, если DevOps должен подготовить и эти секреты заранее.

| Переменная | Назначение |
|---|---|
| `SMTP_HOST` | SMTP-сервер (заготовка, код не подключён) |
| `SMTP_PORT` | Порт SMTP |
| `SMTP_USER` | Логин SMTP |
| `SMTP_PASS` | Пароль SMTP |
| `SMTP_FROM` | Адрес отправителя |

### ⚠️ Важное замечание по коду (не блокирует Docker, но влияет на конфигурацию)

`supabase/client.ts` создаёт клиент с **захардкоженными** URL и anon key прямо в коде, а не через `process.env`:

```ts
export const supabase = createClient(
  'https://hdxylbhdconhttsdvbwv.supabase.co',
  'eyJhbGciOi...'
)
```

Это значит: если в контейнере задать другой `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (например, для другого окружения — staging), этот конкретный клиент всё равно продолжит стучаться в захардкоженный проект Supabase. `supabase/server.ts` при этом env-переменные читает нормально. Стоит унифицировать при следующей правке кода — вне рамок этой Docker-задачи, отдельно не трогал.

---

## Файлы

- `next.config.js` — добавлена директива `output: 'standalone'`.
- `Dockerfile` — три стадии: `deps` → `builder` → `runner`, пользователь `nextjs` (uid 1001), порт 3000.
- `.dockerignore` — исключены `node_modules`, `.next`, `.git`, `.env*`.
- `docker-compose.yml` — сервис `app` на порту 3000, секреты через `env_file: .env.production.local` (это имя уже покрыто `.gitignore`, чтобы не закоммитить случайно).

## Подготовка секретов

Перед сборкой создать `.env.production.local` в корне проекта (рядом с `Dockerfile`) со всеми переменными из таблицы выше — только реальными значениями, файл в git не попадёт.

## Сборка и запуск

### Через Docker CLI

```bash
docker build -t alif-risk-platform:latest .
docker run -d \
  --name alif-risk-platform \
  -p 3000:3000 \
  --env-file .env.production.local \
  alif-risk-platform:latest
```

### Через docker-compose

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

Приложение будет доступно на `http://localhost:3000`.
