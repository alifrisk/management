-- Rate limiting for login attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  key           TEXT PRIMARY KEY,       -- "ip:email"
  attempt_count INTEGER NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ DEFAULT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No public access — only service role key (server route) can read/write
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- (no policies created = anon and authenticated roles have zero access)
