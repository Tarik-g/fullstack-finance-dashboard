function TransactionForm({
  transactionName,
  amount,
  isSubmitting,
  error,
  onNameChange,
  onAmountChange,
  onSubmit,
}) {
  return (
    <section className="panel form-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Neue Buchung</p>
          <h2>Transaktion erfassen</h2>
        </div>
        <span className="status-pill">Live</span>
      </div>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={transactionName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="z. B. Supermarkt"
          />
        </label>
        <label>
          Betrag
          <input
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="z. B. -50"
            inputMode="decimal"
          />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Wird gespeichert ..." : "Transaktion hinzufügen"}
        </button>
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default TransactionForm;
