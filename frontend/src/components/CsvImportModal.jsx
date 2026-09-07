import { useEffect, useRef, useState } from "react";
import { importTransactionsCsv } from "../api/financeApi";

function CsvImportModal({ scrollPosition, onImported, onClose }) {
  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);
  const initialScrollPositionRef = useRef(scrollPosition);
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousActiveElement = document.activeElement;
    const body = document.body;
    const savedScrollPosition = initialScrollPositionRef.current;
    const previousBodyStyles = {
      overflowY: body.style.overflowY,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflowY = "scroll";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollPosition}px`;
    body.style.width = "100%";
    dialog.showModal();

    return () => {
      dialog.close();
      Object.assign(body.style, previousBodyStyles);
      if (
        previousActiveElement instanceof HTMLElement &&
        previousActiveElement.isConnected
      ) {
        previousActiveElement.focus({ preventScroll: true });
      }
      window.scrollTo(0, savedScrollPosition);
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError("Bitte wähle eine CSV-Datei aus.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setReport(null);
    try {
      const result = await importTransactionsCsv(file);
      setReport(result);
      setFile(null);
      fileInputRef.current.value = "";
      onImported(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel(event) {
    event.preventDefault();
    if (!isSubmitting) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="transaction-dialog import-dialog"
      aria-labelledby="csv-import-title"
      onCancel={handleCancel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="modal-shell">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Datenimport</p>
            <h2 id="csv-import-title">CSV importieren</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fenster schließen"
          >
            ×
          </button>
        </header>

        <p className="import-description">
          Unterstützt werden die deutschen Spalten der Beispieldatei sowie die
          englischen API-Feldnamen. Maximal 2 MB und 5.000 Zeilen.
        </p>

        <form className="import-form" onSubmit={handleSubmit}>
          <label>
            CSV-Datei
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
                setReport(null);
              }}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {report && (
            <div className="import-report" role="status">
              <strong>Import abgeschlossen</strong>
              <dl>
                <div>
                  <dt>Eingefügt</dt>
                  <dd>{report.inserted}</dd>
                </div>
                <div>
                  <dt>Duplikate</dt>
                  <dd>{report.skipped}</dd>
                </div>
                <div>
                  <dt>Fehlerhaft</dt>
                  <dd>{report.failed}</dd>
                </div>
              </dl>
              {report.errors.length > 0 && (
                <details>
                  <summary>Fehler anzeigen</summary>
                  <ul>
                    {report.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Schließen
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Wird importiert …" : "Datei importieren"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export default CsvImportModal;
