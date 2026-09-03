import { useMemo, useState } from "react";
import TransactionRow from "./TransactionRow";

const PAGE_SIZE = 10;

function TransactionsPanel({
  transactions,
  totalCount,
  filterKey,
  editingId,
  deletingId,
  deleteError,
  onEdit,
  onDelete,
}) {
  const [sortField, setSortField] = useState("bookingDate");
  const [sortDirection, setSortDirection] = useState("desc");
  const [pageState, setPageState] = useState({ page: 1, filterKey });

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((first, second) => {
      const comparison =
        sortField === "amount"
          ? first.amount - second.amount
          : first.bookingDate.localeCompare(second.bookingDate);

      if (comparison !== 0) {
        return sortDirection === "asc" ? comparison : -comparison;
      }

      return second.id - first.id;
    });
  }, [sortDirection, sortField, transactions]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedTransactions.length / PAGE_SIZE),
  );
  const requestedPage = pageState.filterKey === filterKey ? pageState.page : 1;
  const activePage = Math.min(requestedPage, totalPages);
  const firstItemIndex = (activePage - 1) * PAGE_SIZE;
  const visibleTransactions = sortedTransactions.slice(
    firstItemIndex,
    firstItemIndex + PAGE_SIZE,
  );
  const firstVisibleNumber =
    visibleTransactions.length === 0 ? 0 : firstItemIndex + 1;
  const lastVisibleNumber = firstItemIndex + visibleTransactions.length;

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
    } else {
      setSortField(field);
      setSortDirection("desc");
    }

    setPageState({ page: 1, filterKey });
  }

  function handleMobileSort(event) {
    const [field, direction] = event.target.value.split(":");
    setSortField(field);
    setSortDirection(direction);
    setPageState({ page: 1, filterKey });
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
            <option value="bookingDate:desc">Neueste zuerst</option>
            <option value="bookingDate:asc">Älteste zuerst</option>
            <option value="amount:desc">Höchster Betrag</option>
            <option value="amount:asc">Niedrigster Betrag</option>
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-sort={getAriaSort("bookingDate")}>
                <button
                  className="sort-button"
                  type="button"
                  onClick={() => handleSort("bookingDate")}
                >
                  Datum
                  <span aria-hidden="true">{getSortLabel("bookingDate")}</span>
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
            {visibleTransactions.length === 0 ? (
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

      {visibleTransactions.length > 0 && (
        <nav className="pagination" aria-label="Seitennavigation">
          <span>
            {firstVisibleNumber}–{lastVisibleNumber} von {transactions.length}
          </span>

          <div className="pagination-actions">
            <button
              type="button"
              onClick={() => setPageState({ page: activePage - 1, filterKey })}
              disabled={activePage === 1}
            >
              Zurück
            </button>
            <strong>
              Seite {activePage} von {totalPages}
            </strong>
            <button
              type="button"
              onClick={() => setPageState({ page: activePage + 1, filterKey })}
              disabled={activePage === totalPages}
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
