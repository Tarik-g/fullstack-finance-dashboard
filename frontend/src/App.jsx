import { useState } from "react";

function Transaction({ id, name, amount, onDelete }) {
  return (
    <div>
      <strong>{name}</strong>: {amount} €
      <button onClick={() => onDelete(id)}>Löschen</button>
    </div>
  );
}
function App() {
  const name = "Tarik";
  const [transactions, setTransactions] = useState([]);
  const [transactionName, setTransactionName] = useState("");

  const income = transactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const expenses = Math.abs(
    transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );

  const balance = income - expenses;
  const [amount, setAmount] = useState(0);

  function sayHello() {
    alert("Hallo " + name);
  }

  function addTransaction() {
    const newTransaction = {
      id: transactions.length + 1,
      name: transactionName,
      amount: amount,
    };

    setTransactions([...transactions, newTransaction]);

    setTransactionName("");
    setAmount(0);
  }

  function deleteTransaction(id) {
    const newTransactions = transactions.filter(
      (transaction) => transaction.id !== id,
    );

    setTransactions(newTransactions);
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

      <button onClick={addTransaction}>Transaktion hinzufügen</button>

      <p>Eingegebener Betrag: {amount} €</p>

      <p>Kontostand: {balance} €</p>
      <p>Einnahmen: {income} €</p>
      <p>Ausgaben: {expenses} €</p>

      <button
        onClick={() =>
          setTransactions([
            ...transactions,
            { id: transactions.length + 1, name: "Einzahlung", amount: amount },
          ])
        }
      >
        Betrag einzahlen
      </button>

      <button onClick={() => setBalance(balance - amount)}>
        Betrag ausgeben
      </button>

      <button onClick={sayHello}>Klick mich</button>
      <button onClick={() => setBalance(balance + 100)}>+100 €</button>

      <h2>Transaktionen</h2>

      {transactions.map((transaction) => (
        <Transaction
          key={transaction.id}
          id={transaction.id}
          name={transaction.name}
          amount={transaction.amount}
          onDelete={deleteTransaction}
        />
      ))}
    </div>
  );
}

export default App;
