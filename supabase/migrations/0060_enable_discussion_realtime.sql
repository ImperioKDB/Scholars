-- Deliver discussion inserts, updates, and deletes to connected scholarship pages.
-- The public read policy on scholarship_discussions still controls which rows
-- a client may receive through Supabase Realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scholarship_discussions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_discussions;
  END IF;
END
$$;

ALTER TABLE public.scholarship_discussions REPLICA IDENTITY FULL;
