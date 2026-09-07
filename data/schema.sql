CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    datum DATE NOT NULL,
    empfaenger_sender VARCHAR(255) NOT NULL,
    iban VARCHAR(34),
    verwendungszweck TEXT,
    betrag_euro NUMERIC(12, 2) NOT NULL,
    kategorie VARCHAR(100),
    status VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_transactions_booking_date
    ON public.transactions (datum DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category
    ON public.transactions (kategorie);

-- COALESCE makes duplicate detection work even when optional fields are NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_content
    ON public.transactions (
        datum,
        empfaenger_sender,
        COALESCE(iban, ''),
        COALESCE(verwendungszweck, ''),
        betrag_euro,
        COALESCE(kategorie, ''),
        COALESCE(status, '')
    );
