-- Isolated Amazon click analytics. No legacy tables/settings modified.
CREATE SCHEMA analytics_private;
REVOKE ALL ON SCHEMA analytics_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA analytics_private TO authenticated, service_role;

CREATE TABLE analytics_private.readers (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE analytics_private.readers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analytics_private.readers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON analytics_private.readers TO authenticated;
GRANT ALL ON analytics_private.readers TO service_role;
CREATE POLICY analytics_reader_self ON analytics_private.readers FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.amazon_click_daily (
 book_slug text NOT NULL CHECK (book_slug IN ('noah','labirinto-verde','o-quinto-herdeiro')),
 day date NOT NULL,
 clicks bigint NOT NULL CHECK (clicks >= 0),
 PRIMARY KEY (day, book_slug)
);
ALTER TABLE public.amazon_click_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amazon_click_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.amazon_click_daily TO authenticated;
GRANT ALL ON public.amazon_click_daily TO service_role;
CREATE POLICY analytics_owner_read ON public.amazon_click_daily FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM analytics_private.readers WHERE user_id = (SELECT auth.uid())));

CREATE TABLE analytics_private.click_limits (
 book_slug text PRIMARY KEY CHECK (book_slug IN ('noah','labirinto-verde','o-quinto-herdeiro')),
 minute timestamptz NOT NULL,
 accepted integer NOT NULL CHECK (accepted BETWEEN 1 AND 120)
);
ALTER TABLE analytics_private.click_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analytics_private.click_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON analytics_private.click_limits TO service_role;

CREATE FUNCTION public.analytics_is_owner() RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
 AS $$ SELECT EXISTS (SELECT 1 FROM analytics_private.readers WHERE user_id = (SELECT auth.uid())); $$;
REVOKE ALL ON FUNCTION public.analytics_is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_is_owner() TO authenticated;

CREATE FUNCTION public.record_amazon_click(p_book_slug text) RETURNS boolean
 LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
 AS $$
 DECLARE v_now timestamptz := statement_timestamp(); v_accepted integer;
 BEGIN
   IF p_book_slug IS NULL OR p_book_slug NOT IN ('noah','labirinto-verde','o-quinto-herdeiro') THEN
     RAISE EXCEPTION 'invalid_book' USING ERRCODE = '22023';
   END IF;
   INSERT INTO analytics_private.click_limits AS limits (book_slug, minute, accepted)
   VALUES (p_book_slug, date_trunc('minute', v_now), 1)
   ON CONFLICT (book_slug) DO UPDATE SET
     minute = EXCLUDED.minute,
     accepted = CASE WHEN limits.minute = EXCLUDED.minute THEN limits.accepted + 1 ELSE 1 END
   WHERE limits.minute < EXCLUDED.minute OR (limits.minute = EXCLUDED.minute AND limits.accepted < 120)
   RETURNING accepted INTO v_accepted;
   IF v_accepted IS NULL THEN RETURN false; END IF;
   INSERT INTO public.amazon_click_daily AS daily (book_slug, day, clicks)
   VALUES (p_book_slug, (v_now AT TIME ZONE 'America/Sao_Paulo')::date, 1)
   ON CONFLICT (day, book_slug) DO UPDATE SET clicks = daily.clicks + 1;
   RETURN true;
 END;
 $$;
REVOKE ALL ON FUNCTION public.record_amazon_click(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_amazon_click(text) TO service_role;
