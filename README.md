# Fullstack Finance Dashboard

Fullstack-Anwendung zur Verarbeitung, Analyse und Visualisierung von Banktransaktionen.

Die Transaktionen werden aus einer CSV-Datei eingelesen, mit Pandas verarbeitet, in PostgreSQL gespeichert und über eine FastAPI-REST-API für das React-Frontend bereitgestellt.

## Funktionen

* CSV-Import und Datenvalidierung
* Berechnung von Einnahmen, Ausgaben und Saldo
* Auswertung nach Kategorie und Monat
* Speicherung in PostgreSQL
* REST-API zum Abrufen, Hinzufügen und Löschen von Transaktionen
* Visualisierung im React-Dashboard – in Entwicklung

## Technologien

* Python, FastAPI und Pandas
* PostgreSQL
* React und JavaScript
* Git und GitHub

## Start

Backend:

```bash
python -m uvicorn src.backend.main:app --reload
```

Frontend:

```bash
npm --prefix frontend run dev
```

## Status

Das Projekt befindet sich in aktiver Entwicklung. Backend und grundlegende API-Endpunkte sind vorhanden. Aktuell arbeite ich an der Fertigstellung des React-Dashboards und der Datenvisualisierung.

Es werden ausschließlich synthetische Beispieldaten verwendet.
