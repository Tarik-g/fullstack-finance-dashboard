# Fullstack Finance Dashboard

Fullstack-Anwendung zur Verarbeitung, Analyse und Visualisierung von Banktransaktionen.

Die Transaktionen werden aus einer CSV-Datei eingelesen, mit Pandas verarbeitet, in PostgreSQL gespeichert und über eine FastAPI-REST-API für das React-Frontend bereitgestellt.

## Funktionen

- CSV-Import und Datenvalidierung
- Berechnung von Einnahmen, Ausgaben und Saldo
- Auswertung nach Kategorie und Monat
- Speicherung in PostgreSQL
- REST-API zum Abrufen, Hinzufügen, Bearbeiten und Löschen von Transaktionen
- React-Dashboard mit Suche, Filtern, Sortierung und zehn Buchungen pro Seite
- Serverseitige Auswertungen nach Monat, Tag und Kategorie

## Technologien

- Python, FastAPI und Pandas
- PostgreSQL
- React und JavaScript
- Git und GitHub

## Start

Getestete Laufzeiten: Python 3.14 und Node.js 24. Nach dem Klonen eine virtuelle
Python-Umgebung erstellen und die Abhängigkeiten installieren:

```bash
python -m venv .venv
```

Unter Windows PowerShell mit `.venv\Scripts\Activate.ps1`, unter macOS/Linux mit
`source .venv/bin/activate` aktivieren. Eine bereits vorhandene Umgebung weiterverwenden.

```bash
python -m pip install -r requirements-dev.txt
npm --prefix frontend ci
```

`requirements.txt` enthält die festgelegten direkten Laufzeit-Abhängigkeiten;
`requirements-dev.txt` ergänzt den Testclient. Die Frontend-Versionen stehen in
`frontend/package-lock.json`.

Backend:

```bash
python -m uvicorn src.backend.main:app --reload
http://127.0.0.1:8000/docs
```

Frontend:

```bash
npm --prefix frontend run dev
http://localhost:5173/
```

## Dashboard-API

Das Dashboard lädt nur die aktuelle Tabellenseite. FastAPI übernimmt Suche,
Filter, Sortierung und die Berechnung der Diagrammdaten direkt in PostgreSQL.

```bash
curl "http://127.0.0.1:8000/api/v1/transactions?page=1&page_size=10&year=2026&month=9&transaction_type=expense&sort_by=amount&sort_direction=asc"
```

Die Antwort enthält `items`, `total`, `page`, `page_size` und `total_pages`.
Die Transaktionsfelder bleiben vorerst mit dem deutschen Datenbankschema kompatibel.

- Filter: `search`, `transaction_type` (`all`, `income`, `expense`), `category`, `year`, `month`.
- Pagination: `page` ab 1 und `page_size` von 1 bis 100. Zu hohe Seitenzahlen werden auf die letzte Seite begrenzt.
- Sortierung: `sort_by` (`booking_date`, `amount`) und `sort_direction` (`asc`, `desc`).
- `month` benötigt auch `year`; ungültige Parameter liefern HTTP 422.

Weitere GET-Endpunkte:

- `/api/v1/health`: Erreichbarkeit der API.
- `/api/v1/analytics/summary`: Gesamtzahl, Einnahmen, Ausgaben und Saldo über alle Buchungen.
- `/api/v1/analytics/timeline`: Verlauf mit denselben Filtern wie die Tabelle; `granularity=month` oder `day`.
- `/api/v1/analytics/categories`: Ausgaben je Kategorie mit denselben Filtern wie die Tabelle.
- `/api/v1/categories` und `/api/v1/years`: verfügbare Filterwerte aus der Datenbank.

Die drei oberen Kennzahlen zeigen bewusst immer den Gesamtstand. Filter verändern
Tabelle und Diagramme gemeinsam. Seitenwechsel und Sortierung betreffen nur die
Tabelle. Nach dem Anlegen, Bearbeiten oder Löschen werden alle Daten neu geladen.

Die bisherigen CRUD-Endpunkte unter `/transactions` bleiben kompatibel.
Alle Endpunkte lassen sich auch über `http://127.0.0.1:8000/docs` ausprobieren.

## Tests und Build

Im Projektordner mit aktivierter Python-Umgebung und installierten Abhängigkeiten:

```bash
python -m unittest discover -s tests -v
npm --prefix frontend run lint
npm --prefix frontend run build
```

Zusätzlich die React-Tests ausführen:

```bash
npm --prefix frontend test
```

Zum Lernen und Entwickeln kann `npm --prefix frontend run test:watch` die Tests
bei Dateiänderungen erneut ausführen.

Die oben genannten Unit- und API-Tests benötigen **keine laufenden Server, keine `.env` und
keine PostgreSQL-Datenbank**. Vorhandene Transaktionen bleiben unangetastet.

- `tests/test_dashboard_queries.py`: SQL-Filter, Datumsgrenzen, Sortierung, Pagination und Kennzahlen.
- `tests/test_database_mutations.py`: gebundene SQL-Parameter, Duplikate, Commit und Rollback.
- `tests/test_api.py`: HTTP-Statuscodes, Validierung, CRUD, Analysen, CORS und Schließen der Verbindungen.
- `frontend/src/App.test.jsx`: Lade-, Fehler- und Leerzustände, Suche, Filter, Seitenwechsel sowie Formular- und CRUD-Abläufe.
- `frontend/src/hooks/useDashboardData.test.jsx`: Abbruch von Requests und Schutz vor verspäteten Suchergebnissen.

Die React-Tests verwenden [Vitest](https://vitest.dev/guide/) und Testing Library
mit simulierten HTTP-Antworten. API-Tests verwenden FastAPIs
[TestClient](https://fastapi.tiangolo.com/tutorial/testing/) mit ersetzter
Datenbankgrenze; echte SQL-Befehle werden dabei nicht gegen PostgreSQL ausgeführt.
Die vorhandene Starlette-Version nutzt dafür HTTPX2.

Diese Tests ersetzen keinen vollständigen Ende-zu-Ende-Test: Das Chart-Rendering
ist in den App-Tests ersetzt, und jsdom bildet das native Dialogverhalten nur
vereinfacht ab. Responsive Darstellung, Fokusführung und echte PostgreSQL-
Constraints werden zusätzlich mit dem folgenden Playwright-Test geprüft.

Für einen manuellen Smoke-Test beide Entwicklungsserver starten: zweite Seite
öffnen, Betrag sortieren, nach einem Namen suchen und zwischen Gesamt-, Jahres-
und Monatsansicht wechseln. Eine Suche ohne Treffer muss einen leeren Zustand
anzeigen; „Filter zurücksetzen“ stellt die vollständige Ansicht wieder her.

## End-to-End-Tests mit Playwright

Der Browser-Test verwendet echtes React, FastAPI und PostgreSQL – keine simulierten
HTTP-Antworten. Er legt eine Ausgabe an, bearbeitet Betrag und Kategorie, lädt die
Seite neu und löscht die Ausgabe wieder. Nach jedem Schritt prüft er Tabelle,
Kennzahlen, Kategorie-Diagramm und den Tooltip des Balkendiagramms. Zusätzliche
SQL-Abfragen bestätigen die tatsächlich gespeicherten Werte. Ein zweiter Test
prüft Tab-Navigation, Fokusbegrenzung und Escape im nativen Formular-Dialog.
Beide Abläufe laufen in Chromium mit Desktop- und Smartphone-Ansicht.

Einmalig den Testbrowser installieren:

```bash
npm --prefix frontend exec -- playwright install chromium
```

Danach aus dem Projektordner:

```bash
npm --prefix frontend run test:e2e
```

Voraussetzungen: installierte Projekt-Abhängigkeiten und PostgreSQL-Servertools
(`initdb`, `pg_ctl`). Unter Windows findet der Runner Installationen unter
`C:\Program Files\PostgreSQL` automatisch. Alternativ `E2E_PG_BIN` auf den
PostgreSQL-`bin`-Ordner setzen; auf Linux/macOS können die Tools auch im `PATH`
liegen. `E2E_PYTHON` kann den Python-Interpreter festlegen; sonst wird zuerst die
Projekt-venv verwendet. Lokaler Docker-Start ist nicht erforderlich.

So bleiben die Entwicklungsdaten getrennt:

- Der Runner liest weder `.env` noch `DB_*` oder `DATABASE_URL` für seine Verbindung.
- Standardmäßig startet er einen temporären, passwortgeschützten PostgreSQL-Server auf `127.0.0.1` und einem freien Port.
- Er erstellt eine neue Datenbank mit zufälligem Namen `finance_e2e_<run-id>` und drei synthetischen Buchungen. Vor jedem Test und Retry wird nur diese Datenbank neu befüllt.
- Der echte API-Prozess nutzt Port **8001**, die separate gebaute Oberfläche Port **4173**. Beide müssen frei sein; vorhandene Server werden ausdrücklich nicht wiederverwendet. Der Test-Build liegt getrennt in `frontend/.e2e-dist`.
- Nach Erfolg oder Testfehler wird die erzeugte Datenbank gelöscht und der temporäre PostgreSQL-Server beendet. Entwicklungsdatenbanken werden nicht zurückgesetzt.

Für CI oder einen bereits isolierten lokalen Test-PostgreSQL kann
`E2E_POSTGRES_URL` angegeben werden. Sie muss explizit auf dessen lokale
`postgres`-Administrationsdatenbank zeigen (Host, Port, Benutzer und Passwort),
z. B. `postgresql://finance_e2e:test-password@127.0.0.1:5433/postgres`.
Der Benutzer benötigt `CREATEDB`. Auch hier erzeugt und löscht der Runner nur
seine neue zufällig benannte Datenbank. Keine Produktiv-Zugangsdaten verwenden.

`frontend/playwright-report` enthält den HTML-Bericht; Screenshots und Fehler-
Traces liegen unter `frontend/test-results`. Zum Anzeigen nach einem Lauf:

```bash
cd frontend
npx --no-install playwright show-report
```

Die Serververwaltung folgt Playwrights [Web-Server-Konfiguration](https://playwright.dev/docs/test-webserver).
Die mobile Prüfung emuliert einen Chromium-Smartphone-Viewport; sie ersetzt
keinen separaten Test auf iOS/Safari oder einem physischen Gerät.

## Continuous Integration

`.github/workflows/ci.yml` führt bei Pushes und Pull Requests drei unabhängige
Jobs aus: Backend-Tests mit Python 3.14, React-Tests/Lint/Build mit Node.js 24
und Playwright mit einem kurzlebigen PostgreSQL-18-Service. Nur der E2E-Job
benötigt eine echte Datenbank; seine Zugangsdaten gelten ausschließlich für
den wegwerfbaren CI-Container. Der Workflow kann auch im GitHub-Tab „Actions“
manuell gestartet werden. Er verwendet keine Projekt-Secrets und führt weder
den Entwicklungsdaten-Seed noch ein Deployment aus. Der Playwright-Bericht
inklusive Screenshots und Fehler-Traces bleibt sieben Tage als Artefakt verfügbar.

GitHub richtet die Laufzeitumgebungen mit den offiziellen Setup-Actions ein;
siehe auch die [GitHub-Anleitung für Python-Tests](https://docs.github.com/en/actions/tutorials/build-and-test-code/python).
Ein tatsächlicher GitHub-Lauf erfolgt erst nach dem Commit und Push des Workflows.

## Demo-Daten neu erstellen

Das Seed-Skript erzeugt reproduzierbare, vollständig synthetische Transaktionen
für jeden Monat der Jahre 2025 und 2026:

```bash
python data/seed_database.py --write-csv --apply
```

`--write-csv` aktualisiert `data/transactions.csv`. `--apply` ersetzt alle
vorhandenen Zeilen in `public.transactions`. Die Datenbankänderung erfolgt in
einer Transaktion und wird bei einem Fehler vollständig zurückgerollt.

## Status

Das Projekt befindet sich in aktiver Entwicklung. Dashboard, CRUD, serverseitige
Filter, Pagination und Diagrammauswertungen sind vorhanden. Automatisierte React-,
API- und SQL-Tests, Playwright-End-to-End-Tests sowie ein CI-Workflow sind
eingerichtet. Nächste Schritte sind die englische Portfolio-README und die
Vorbereitung der Veröffentlichung.

Es werden ausschließlich synthetische Beispieldaten verwendet.
