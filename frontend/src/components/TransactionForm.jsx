function TransactionForm({
  transaction,
  categories,
  transactionMode,
  isSubmitting,
  isEditing,
  error,
  onFieldChange,
  onSubmit,
  onCancel,
}) {
  let submitLabel = "Einnahme speichern";

  if (isSubmitting) {
    submitLabel = "Wird gespeichert ...";
  } else if (isEditing) {
    submitLabel = "Änderungen speichern";
  } else if (transactionMode === "expense") {
    submitLabel = "Ausgabe speichern";
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Datum
        <input
          type="date"
          value={transaction.bookingDate}
          onChange={(event) =>
            onFieldChange("bookingDate", event.target.value)
          }
          required
        />
      </label>

      <label>
        Betrag
        <input
          value={transaction.amount}
          onChange={(event) => onFieldChange("amount", event.target.value)}
          placeholder="z. B. 50,00"
          inputMode="decimal"
          required
        />
        {!isEditing && (
          <span className="field-hint">
            Das Vorzeichen wird automatisch gesetzt.
          </span>
        )}
      </label>

      <label className="field-wide">
        Empfänger / Sender
        <input
          value={transaction.counterparty}
          onChange={(event) =>
            onFieldChange("counterparty", event.target.value)
          }
          placeholder="z. B. Supermarkt"
          required
        />
      </label>

      <label className="field-wide">
        Verwendungszweck
        <input
          value={transaction.purpose}
          onChange={(event) => onFieldChange("purpose", event.target.value)}
          placeholder="z. B. Wocheneinkauf"
        />
      </label>

      <label className="field-wide">
        IBAN
        <input
          value={transaction.iban}
          onChange={(event) => onFieldChange("iban", event.target.value)}
          placeholder="z. B. DE89370400440532013000"
        />
      </label>

      <label>
        Kategorie
        <select
          value={transaction.category}
          onChange={(event) => onFieldChange("category", event.target.value)}
        >
          <option value="">Ohne Kategorie</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label>
        Status
        <input
          value={transaction.status}
          onChange={(event) => onFieldChange("status", event.target.value)}
          placeholder="z. B. Gebucht"
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Abbrechen
        </button>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export default TransactionForm;
