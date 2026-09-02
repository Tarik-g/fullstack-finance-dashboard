import { formatCurrency, formatDate } from "../utils/formatters";

function TransactionRow({
  transaction,
  onEdit,
  onDelete,
  isEditing,
  isDeleting,
}) {
  const isIncome = transaction.amount >= 0;

  return (
    <tr>
      <td data-label="Datum">{formatDate(transaction.bookingDate)}</td>
      <td data-label="Empfänger / Sender">
        <strong>{transaction.counterparty}</strong>
        <span className="table-subline">{transaction.iban || "Keine IBAN"}</span>
      </td>
      <td data-label="Verwendungszweck">{transaction.purpose || "–"}</td>
      <td data-label="Kategorie">
        <span className="category-tag">
          {transaction.category || "Ohne Kategorie"}
        </span>
      </td>
      <td data-label="Status">
        <span className="booking-status">
          {transaction.status || "Unbekannt"}
        </span>
      </td>
      <td
        className={`transaction-amount ${
          isIncome ? "amount-positive" : "amount-negative"
        }`}
        data-label="Betrag"
      >
        {formatCurrency(transaction.amount)}
      </td>
      <td data-label="Aktion">
        <div className="row-actions">
          <button
            className="edit-button"
            type="button"
            onClick={() => onEdit(transaction)}
            aria-label={`${transaction.counterparty} bearbeiten`}
          >
            {isEditing ? "In Bearbeitung" : "Bearbeiten"}
          </button>
          <button
            className="delete-button"
            type="button"
            onClick={() => onDelete(transaction.id)}
            disabled={isDeleting}
            aria-label={`${transaction.counterparty} löschen`}
          >
            {isDeleting ? "..." : "Löschen"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default TransactionRow;
