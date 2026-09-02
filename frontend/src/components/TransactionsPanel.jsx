import TransactionFilters from "./TransactionFilters";
import TransactionRow from "./TransactionRow";

function TransactionsPanel({
  transactions,
  totalCount,
  deletingId,
  deleteError,
  onDelete,
  searchTerm,
  typeFilter,
  categoryFilter,
  categories,
  onSearchChange,
  onTypeChange,
  onCategoryChange,
}) {
  return (
    <section className="panel transactions-panel">
      <div className="section-heading table-heading">
        <div>
          <p className="eyebrow">Aktivität</p>
          <h2>Letzte Transaktionen</h2>
        </div>
        <span className="transaction-count">
          {transactions.length} von {totalCount} Buchungen
        </span>
      </div>

      <TransactionFilters
        searchTerm={searchTerm}
        typeFilter={typeFilter}
        categoryFilter={categoryFilter}
        categories={categories}
        onSearchChange={onSearchChange}
        onTypeChange={onTypeChange}
        onCategoryChange={onCategoryChange}
      />

      {deleteError && (
        <p className="form-error" role="alert">
          {deleteError}
        </p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Empfänger / Sender</th>
              <th>Verwendungszweck</th>
              <th>Kategorie</th>
              <th>Status</th>
              <th>Betrag</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td className="empty-table" colSpan="7">
                  Keine passenden Transaktionen gefunden.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onDelete={onDelete}
                  isDeleting={deletingId === transaction.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default TransactionsPanel;
