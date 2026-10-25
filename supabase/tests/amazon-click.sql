BEGIN;
-- Synthetic transactional fixtures are always rolled back; no credentials or users are created.
-- Fresh analytics tables verified empty; no deletion needed.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.amazon_click_daily) OR EXISTS (SELECT 1 FROM analytics_private.click_limits) THEN RAISE EXCEPTION 'Fixtures require empty analytics tables'; END IF; END $$;
DO $$
DECLARE i integer; v boolean;
BEGIN
 FOR i IN 1..120 LOOP
   IF NOT public.record_amazon_click('noah') THEN RAISE EXCEPTION 'unexpected rejection'; END IF;
 END LOOP;
 IF public.record_amazon_click('noah') THEN RAISE EXCEPTION 'cap failed'; END IF;
 IF (SELECT clicks FROM public.amazon_click_daily WHERE book_slug='noah' AND day=(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date) <> 120 THEN RAISE EXCEPTION 'count or date failed'; END IF;
 BEGIN
   PERFORM public.record_amazon_click('bad-book');
   RAISE EXCEPTION 'bad slug accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 UPDATE analytics_private.click_limits SET minute=date_trunc('minute',statement_timestamp())+interval '1 minute' WHERE book_slug='noah';
 IF public.record_amazon_click('noah') THEN RAISE EXCEPTION 'stale request rolled limit backward'; END IF;
 UPDATE analytics_private.click_limits SET minute=date_trunc('minute',statement_timestamp())-interval '1 minute' WHERE book_slug='noah';
 IF NOT public.record_amazon_click('noah') THEN RAISE EXCEPTION 'new minute did not reset'; END IF;
 IF (SELECT accepted FROM analytics_private.click_limits WHERE book_slug='noah') <> 1 THEN RAISE EXCEPTION 'reset count failed'; END IF;
 IF ('2026-10-25 02:59:59+00'::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date <> DATE '2026-10-24'
 OR ('2026-10-25 03:00:00+00'::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date <> DATE '2026-10-25' THEN RAISE EXCEPTION 'timezone boundary failed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
-- Synthetic non-owner JWT context is a database policy test, not a credential/session.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF public.analytics_is_owner() THEN RAISE EXCEPTION 'nonowner authorized'; END IF;
 IF EXISTS (SELECT 1 FROM public.amazon_click_daily) THEN RAISE EXCEPTION 'nonowner sees data'; END IF;
END $$;
RESET ROLE;
-- Use authorized reader's UUID only inside rollback transaction to test SQL policy.
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM analytics_private.readers LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT public.analytics_is_owner() THEN RAISE EXCEPTION 'owner denied'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.amazon_click_daily) THEN RAISE EXCEPTION 'owner cannot see fixture'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_table_privilege('anon','public.amazon_click_daily','SELECT') THEN RAISE EXCEPTION 'anon read granted'; END IF;
 IF has_function_privilege('anon','public.record_amazon_click(text)','EXECUTE') OR has_function_privilege('authenticated','public.record_amazon_click(text)','EXECUTE') THEN RAISE EXCEPTION 'public direct writes allowed'; END IF;
END $$;
ROLLBACK;
