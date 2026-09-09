CREATE TABLE IF NOT EXISTS public.demo_sessions (
    id UUID PRIMARY KEY,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    datum DATE NOT NULL,
    empfaenger_sender VARCHAR(255) NOT NULL,
    iban VARCHAR(34),
    verwendungszweck TEXT,
    betrag_euro NUMERIC(12, 2) NOT NULL,
    kategorie VARCHAR(100),
    status VARCHAR(50),
    demo_session_id UUID
);

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS demo_session_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_transactions_demo_session'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT fk_transactions_demo_session
            FOREIGN KEY (demo_session_id)
            REFERENCES public.demo_sessions (id)
            ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_transactions_booking_date
    ON public.transactions (datum DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category
    ON public.transactions (kategorie);

CREATE INDEX IF NOT EXISTS idx_transactions_demo_session
    ON public.transactions (demo_session_id);

-- COALESCE makes duplicate detection work even when optional fields are NULL.
DROP INDEX IF EXISTS public.uq_transactions_content;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_content
    ON public.transactions (
        COALESCE(demo_session_id::text, 'template'),
        datum,
        empfaenger_sender,
        COALESCE(iban, ''),
        COALESCE(verwendungszweck, ''),
        betrag_euro,
        COALESCE(kategorie, ''),
        COALESCE(status, '')
    );
