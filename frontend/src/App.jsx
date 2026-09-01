import { useEffect, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE");

function TransactionRow({ transaction, onDelete, isDeleting }) {
  const formattedDate = dateFormatter.format(
    new Date(`${transaction.bookingDate}T00:00:00`),
  );

  return (
    <tr>
      <td>{formattedDate}</td>
      <td>{transaction.counterparty}</td>
      <td>{transaction.purpose || "—"}</td>
      <td>{transaction.category || "Ohne Kategorie"}</td>
      <td>{transaction.status || "—"}</td>
      <td>{currencyFormatter.format(transaction.amount)}</td>
      <td>
        <button
          onClick={() => onDelete(transaction.id)}
          disabled={isDeleting}
          aria-label={`${transaction.counterparty} löschen`}
        >
          {isDeleting ? "Wird gelöscht …" : "Löschen"}
        </button>
      </td>
    </tr>
  );
}
function App() {
  const name = "Tarik";
  // useeffect and  fetch()
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactionName, setTransactionName] = useState("");
  const [amount, setAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  function loadTransactions() {
    return fetch("http://localhost:8000/transactions")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP-Fehler: ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        const mappedTransactions = data.map((transaction) => ({
          id: transaction.id,
          bookingDate: transaction.datum,
          counterparty: transaction.empfaenger_sender,
          iban: transaction.iban,
          purpose: transaction.verwendungszweck,
          amount: Number(transaction.betrag_euro),
          category: transaction.kategorie,
          status: transaction.status,
        }));

        setTransactions(mappedTransactions);
      })
      .catch((error) => {
        setError(error.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const income = transactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const expenses = Math.abs(
    transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );

  const balance = income - expenses;

  async function addTransaction() {
    const normalizedName = transactionName.trim();

    if (!normalizedName) {
      setFormError("Bitte gib einen Empfänger oder Absender ein.");
      return;
    }

    if (amount === 0) {
      setFormError("Der Betrag darf nicht 0 sein.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("http://localhost:8000/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datum: new Date().toISOString().slice(0, 10),
          empfaenger_sender: normalizedName,
          betrag_euro: amount,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Transaktion konnte nicht gespeichert werden: ${response.status}`,
        );
      }

      setTransactionName("");
      setAmount(0);

      await loadTransactions();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteTransaction(id) {
    const confirmed = window.confirm(
      "Möchtest du diese Transaktion wirklich löschen?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setDeleteError(null);

    try {
      const response = await fetch(`http://localhost:8000/transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          `Transaktion konnte nicht gelöscht werden: ${response.status}`,
        );
      }

      await loadTransactions();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return <p>Transaktionen werden geladen …</p>;
  }

  if (error) {
    return <p role="alert">Fehler: {error}</p>;
  }

  return (
    <div>
      <h1>Hallo {name}</h1>
      <input
        type="text"
        placeholder="Transaktion eingeben"
        value={transactionName}
        onChange={(event) => setTransactionName(event.target.value)}
      />
      <input
        type="number"
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value))}
      />
      {formError && <p role="alert">{formError}</p>}
      <button onClick={addTransaction} disabled={isSubmitting}>
        {isSubmitting ? "Wird gespeichert …" : "Transaktion hinzufügen"}
      </button>
      <p>Eingegebener Betrag: {amount} €</p>
      <p>Kontostand: {currencyFormatter.format(balance)}</p>
      <p>Einnahmen: {currencyFormatter.format(income)}</p>
      <p>Ausgaben: {currencyFormatter.format(expenses)}</p>
      {deleteError && <p role="alert">{deleteError}</p>}
      <h2>Transaktionen</h2>
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Empfänger / Absender</th>
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
              <td colSpan="7">Keine Transaktionen vorhanden.</td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onDelete={deleteTransaction}
                isDeleting={deletingId === transaction.id}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
