# Finance Dashboard

Ein Fullstack-Dashboard zum Erfassen, Filtern und Auswerten synthetischer
Banktransaktionen. React zeigt das Dashboard, FastAPI stellt die REST-API bereit
und PostgreSQL speichert die Daten.

## Funktionen

- Einnahmen und Ausgaben anlegen, bearbeiten und löschen
- Suche, Filter, Sortierung und Pagination
- Kennzahlen für Kontostand, Einnahmen und Ausgaben
- Auswertungen nach Zeitraum und Kategorie
- Responsive Oberfläche für Desktop und Mobilgeräte
- Automatisierte Backend-, React- und Playwright-Tests

## Technologien

- React, Vite und JavaScript
- FastAPI, Pandas und Psycopg
- PostgreSQL
- Vitest, Testing Library und Playwright

## Lokale Einrichtung

Voraussetzungen: Python 3.14, Node.js 24 und PostgreSQL.

### 1. Abhängigkeiten installieren

```bash
python -m venv .venv
```

Virtuelle Umgebung aktivieren:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux
source .venv/bin/activate
```

Danach die Abhängigkeiten installieren:

```bash
python -m pip install -r requirements-dev.txt
npm --prefix frontend ci
```

### 2. PostgreSQL konfigurieren

Eine Datei `.env` im Projektordner anlegen:

```env
DB_NAME=finance_dashboard
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

Die Tabelle in der gewählten Datenbank erstellen:

```sql
CREATE TABLE public.transactions (
    id SERIAL PRIMARY KEY,
    datum DATE NOT NULL,
    empfaenger_sender VARCHAR(255) NOT NULL,
    iban VARCHAR(34),
    verwendungszweck TEXT,
    betrag_euro NUMERIC(12, 2) NOT NULL,
    kategorie VARCHAR(100),
    status VARCHAR(50),
    UNIQUE (
        datum,
        empfaenger_sender,
        iban,
        verwendungszweck,
        betrag_euro,
        kategorie,
        status
    )
);
```

Optional die synthetischen Beispieldaten für 2025 und 2026 laden:

```bash
python data/seed_database.py --write-csv --apply
```

> Der Parameter `--apply` ersetzt alle vorhandenen Zeilen in
> `public.transactions`.

### 3. Anwendung starten

Backend:

```bash
python -m uvicorn src.backend.main:app --reload
```

Frontend in einem zweiten Terminal:

```bash
npm --prefix frontend run dev
```

- Dashboard: [http://localhost:5173](http://localhost:5173)
- API-Dokumentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Tests

```bash
# Backend- und API-Tests
python -m unittest discover -s tests -v

# React-Tests, Lint und Produktions-Build
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build

# Einmalig Playwright-Chromium installieren und E2E-Tests starten
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

Die Playwright-Tests verwenden eine temporäre, getrennte PostgreSQL-Datenbank
und verändern die Entwicklungsdaten nicht. GitHub Actions führt alle Prüfungen
bei Pushes und Pull Requests automatisch aus.

## Hinweise

- Das Projekt verwendet ausschließlich synthetische Beispieldaten.
- Es gibt aktuell keinen Login und keine Verbindung zu einer echten Bank-API.
