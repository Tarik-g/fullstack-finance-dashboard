import { formatCurrency } from "../utils/formatters";

function SummaryCards({ balance, income, expenses }) {
  return (
    <section className="summary-grid" aria-label="Finanzübersicht">
      <article className="summary-card balance-card">
        <span className="summary-icon">€</span>
        <p>Kontostand</p>
        <strong>{formatCurrency(balance)}</strong>
        <small>Aktueller Gesamtstand</small>
      </article>

      <article className="summary-card income-card">
        <span className="summary-icon">↑</span>
        <p>Einnahmen</p>
        <strong>{formatCurrency(income)}</strong>
        <small>Alle positiven Buchungen</small>
      </article>

      <article className="summary-card expense-card">
        <span className="summary-icon">↓</span>
        <p>Ausgaben</p>
        <strong>{formatCurrency(expenses)}</strong>
        <small>Alle negativen Buchungen</small>
      </article>
    </section>
  );
}

export default SummaryCards;
