import { formatCurrency, formatDate } from "../utils/formatters";

function TransactionRow({ transaction, onDelete, isDeleting }) {
  const isIncome = transaction.amount >= 0;

  return (
    <tr>
      <td>{formatDate(transaction.bookingDate)}</td>
      <td>
        <strong>{transaction.counterparty}</strong>
        <span className="table-subline">{transaction.iban || "Keine IBAN"}</span>
      </td>
      <td>{transaction.purpose || "–"}</td>
      <td>
        <span className="category-tag">
          {transaction.category || "Ohne Kategorie"}
        </span>
      </td>
      <td>
        <span className="booking-status">
          {transaction.status || "Unbekannt"}
        </span>
      </td>
      <td className={isIncome ? "amount-positive" : "amount-negative"}>
        {formatCurrency(transaction.amount)}
      </td>
      <td>
        <button
          className="delete-button"
          type="button"
          onClick={() => onDelete(transaction.id)}
          disabled={isDeleting}
          aria-label={`${transaction.counterparty} löschen`}
        >
          {isDeleting ? "..." : "Löschen"}
        </button>
      </td>
    </tr>
  );
}

export default TransactionRow;
