ALTER TABLE cfp_reports ADD COLUMN IF NOT EXISTS outflows_data jsonb;
ALTER TABLE cfp_reports ADD COLUMN IF NOT EXISTS inflows_data jsonb;
ALTER TABLE cfp_reports ADD COLUMN IF NOT EXISTS cfp_results jsonb;
