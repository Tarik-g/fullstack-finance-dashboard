import { useEffect, useState } from "react";

function Transaction({ id, name, amount, onDelete, isDeleting }) {
  return (
    <div>
      <strong>{name}</strong>: {amount} €
      <button onClick={() => onDelete(id)} disabled={isDeleting}>
        {isDeleting ? "Wird gelöscht …" : "Löschen"}
      </button>
    </div>
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
          name: transaction.empfaenger_sender,
          amount: Number(transaction.betrag_euro),
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
      <p>Kontostand: {balance} €</p>
      <p>Einnahmen: {income} €</p>
      <p>Ausgaben: {expenses} €</p>
      {deleteError && <p role="alert">{deleteError}</p>}
      <h2>Transaktionen</h2>
      {transactions.map((transaction) => (
        <Transaction
          key={transaction.id}
          id={transaction.id}
          name={transaction.name}
          amount={transaction.amount}
          onDelete={deleteTransaction}
          isDeleting={deletingId === transaction.id}
        />
      ))}
    </div>
  );
}

export default App;
