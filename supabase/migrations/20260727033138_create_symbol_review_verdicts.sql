-- Weekly LLM review of stale symbols: operator-scoped research verdicts.
-- Service-role only (cron/admin path), same grant pattern as
-- quote_repair_queue (20260703042511). Nothing here is auto-applied; the
-- operator reads a digest and runs the retirement SQL by hand.

BEGIN;

CREATE TABLE IF NOT EXISTS public.symbol_review_verdicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol_id uuid NOT NULL
    REFERENCES public.symbols(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  alias_id uuid NOT NULL
    REFERENCES public.symbol_aliases(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  alias_value text NOT NULL,
  verdict text NOT NULL,
  confidence text NOT NULL,
  summary text NOT NULL,
  evidence_urls text[] NOT NULL,
  successor_ticker text,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  emailed_at timestamptz,

  CONSTRAINT symbol_review_verdicts_verdict_check
    CHECK (
      verdict IN (
        'retired',
        'renamed',
        'thinly_traded',
        'provider_issue',
        'unknown'
      )
    ),

  CONSTRAINT symbol_review_verdicts_confidence_check
    CHECK (confidence IN ('high', 'medium', 'low')),

  -- Every verdict turns on CURRENT listing status, so an ungrounded one is
  -- worse than none: it reaches the operator looking exactly like a
  -- researched one. The worker already refuses to insert without search
  -- sources; this makes "a verdict row was grounded" a database invariant
  -- rather than a property of one code path.
  CONSTRAINT symbol_review_verdicts_evidence_urls_check
    CHECK (cardinality(evidence_urls) > 0),

  -- successor_ticker is meaningful only for 'renamed', where the digest
  -- prints it; a 'renamed' row without one is not actionable.
  CONSTRAINT symbol_review_verdicts_successor_ticker_check
    CHECK (
      CASE
        WHEN verdict = 'renamed'
          THEN successor_ticker IS NOT NULL AND btrim(successor_ticker) <> ''
        ELSE successor_ticker IS NULL
      END
    )
);

COMMENT ON TABLE public.symbol_review_verdicts IS
  'LLM research verdicts for stale market symbols; the operator applies changes manually. Rows are immutable except emailed_at (digest delivery bookkeeping).';

COMMENT ON COLUMN public.symbol_review_verdicts.alias_id IS
  'The active Yahoo ticker alias the verdict is about. The digest scopes its retirement SQL by this id, never by ticker value: active ticker aliases are unique by (source, value) only while live, so a freed ticker can be re-registered to a different security before the operator acts.';

COMMENT ON COLUMN public.symbol_review_verdicts.alias_value IS
  'Point-in-time copy of the researched ticker, for digest labels only.';

COMMENT ON COLUMN public.symbol_review_verdicts.evidence_urls IS
  'Pages the search provider reported as consulted, not model-authored links.';

COMMENT ON COLUMN public.symbol_review_verdicts.emailed_at IS
  'Set when a digest including this row was sent; NULL rows are the pending-digest set.';

-- Cooldown lookup: most recent verdict per symbol.
CREATE INDEX IF NOT EXISTS idx_symbol_review_verdicts_symbol_created
  ON public.symbol_review_verdicts(symbol_id, created_at DESC);

ALTER TABLE public.symbol_review_verdicts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Service role can manage symbol review verdicts"
    ON public.symbol_review_verdicts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

REVOKE ALL ON TABLE public.symbol_review_verdicts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.symbol_review_verdicts TO service_role;

COMMIT;
