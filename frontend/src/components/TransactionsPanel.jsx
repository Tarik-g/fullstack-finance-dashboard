import TransactionRow from "./TransactionRow";

function TransactionsPanel({
  transactions,
  filteredCount,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  sortField,
  sortDirection,
  isLoading,
  loadError,
  editingId,
  deletingId,
  deleteError,
  onPageChange,
  onSortChange,
  onEdit,
  onDelete,
}) {
  const firstItemIndex = (currentPage - 1) * pageSize;
  const visibleTransactions = transactions;
  const firstVisibleNumber =
    visibleTransactions.length === 0 ? 0 : firstItemIndex + 1;
  const lastVisibleNumber = firstItemIndex + visibleTransactions.length;

  function handleSort(field) {
    const direction =
      sortField === field && sortDirection === "desc" ? "asc" : "desc";
    onSortChange(field, direction);
  }

  function handleMobileSort(event) {
    const [field, direction] = event.target.value.split(":");
    onSortChange(field, direction);
  }

  function getSortLabel(field) {
    if (sortField !== field) {
      return "↕";
    }

    return sortDirection === "asc" ? "↑" : "↓";
  }

  function getAriaSort(field) {
    if (sortField !== field) {
      return "none";
    }

    return sortDirection === "asc" ? "ascending" : "descending";
  }

  return (
    <section className="panel transactions-panel" aria-busy={isLoading}>
      <div className="section-heading table-heading">
        <div>
          <p className="eyebrow">Aktivität</p>
          <h2>Letzte Transaktionen</h2>
        </div>
        <span className="transaction-count">
          {isLoading
            ? "Lade Buchungen …"
            : `${filteredCount} von ${totalCount} Buchungen`}
        </span>
      </div>

      {deleteError && (
        <p className="form-error" role="alert">
          {deleteError}
        </p>
      )}

      <div className="mobile-table-controls">
        <label>
          Sortierung
          <select
            value={`${sortField}:${sortDirection}`}
            onChange={handleMobileSort}
          >
            <option value="booking_date:desc">Neueste zuerst</option>
            <option value="booking_date:asc">Älteste zuerst</option>
            <option value="amount:desc">Höchster Betrag</option>
            <option value="amount:asc">Niedrigster Betrag</option>
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-sort={getAriaSort("booking_date")}>
                <button
                  className="sort-button"
                  type="button"
                  onClick={() => handleSort("booking_date")}
                >
                  Datum
                  <span aria-hidden="true">{getSortLabel("booking_date")}</span>
                </button>
              </th>
              <th>Empfänger / Sender</th>
              <th>Verwendungszweck</th>
              <th>Kategorie</th>
              <th>Status</th>
              <th aria-sort={getAriaSort("amount")}>
                <button
                  className="sort-button amount-sort-button"
                  type="button"
                  onClick={() => handleSort("amount")}
                >
                  Betrag
                  <span aria-hidden="true">{getSortLabel("amount")}</span>
                </button>
              </th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="empty-table" colSpan="7" data-label="Status">
                  Transaktionen werden geladen …
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td className="empty-table" colSpan="7" data-label="Fehler">
                  Die Transaktionen konnten nicht geladen werden.
                </td>
              </tr>
            ) : visibleTransactions.length === 0 ? (
              <tr>
                <td className="empty-table" colSpan="7" data-label="Ergebnis">
                  Keine passenden Transaktionen gefunden.
                </td>
              </tr>
            ) : (
              visibleTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isEditing={editingId === transaction.id}
                  isDeleting={deletingId === transaction.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && visibleTransactions.length > 0 && (
        <nav className="pagination" aria-label="Seitennavigation">
          <span>
            {firstVisibleNumber}–{lastVisibleNumber} von {filteredCount}
          </span>

          <div className="pagination-actions">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Zurück
            </button>
            <strong>
              Seite {currentPage} von {totalPages}
            </strong>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Weiter
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}

export default TransactionsPanel;
