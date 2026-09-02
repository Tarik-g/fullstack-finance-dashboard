import { useEffect, useState } from "react";
import {
  createTransaction,
  deleteTransaction,
  getCategories,
  getTransactions,
} from "./api/financeApi";
import DashboardHeader from "./components/DashboardHeader";
import SummaryCards from "./components/SummaryCards";
import TransactionForm from "./components/TransactionForm";
import TransactionsPanel from "./components/TransactionsPanel";

function App() {
  const [name] = useState("Tarik");
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactionName, setTransactionName] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);

  function loadTransactions() {
    return getTransactions()
      .then((data) => {
        setTransactions(data);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function loadCategories() {
    return getCategories()
      .then(setCategories)
      .catch((requestError) => {
        console.error(requestError);
      });
  }

  useEffect(() => {
    loadTransactions();
    loadCategories();
  }, []);

  async function handleAddTransaction(event) {
    event.preventDefault();
    setFormError(null);

    const normalizedName = transactionName.trim();
    const numericAmount = Number(amount.replace(",", "."));

    if (!normalizedName) {
      setFormError("Bitte gib einen Namen ein.");
      return;
    }

    if (!amount.trim() || !Number.isFinite(numericAmount)) {
      setFormError("Bitte gib einen gültigen Betrag ein.");
      return;
    }

    setIsSubmitting(true);

    try {
      await createTransaction({
        counterparty: normalizedName,
        amount: numericAmount,
      });
      setTransactionName("");
      setAmount("");
      await loadTransactions();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteTransaction(id) {
    setDeletingId(id);
    setDeleteError(null);

    try {
      await deleteTransaction(id);
      await loadTransactions();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = [
      transaction.counterparty,
      transaction.purpose,
      transaction.category,
      transaction.iban,
      transaction.status,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));

    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "income" && transaction.amount >= 0) ||
      (typeFilter === "expense" && transaction.amount < 0);

    const matchesCategory =
      categoryFilter === "all" || transaction.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const income = transactions.reduce(
    (sum, transaction) =>
      transaction.amount > 0 ? sum + transaction.amount : sum,
    0,
  );
  const expenses = transactions.reduce(
    (sum, transaction) =>
      transaction.amount < 0 ? sum + Math.abs(transaction.amount) : sum,
    0,
  );
  const balance = income - expenses;

  if (isLoading) {
    return <div className="state-screen">Transaktionen werden geladen ...</div>;
  }

  if (error) {
    return (
      <div className="state-screen state-error">
        <strong>Die Daten konnten nicht geladen werden.</strong>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <DashboardHeader name={name} />

      <main className="dashboard-content">
        <TransactionForm
          transactionName={transactionName}
          amount={amount}
          isSubmitting={isSubmitting}
          error={formError}
          onNameChange={setTransactionName}
          onAmountChange={setAmount}
          onSubmit={handleAddTransaction}
        />

        <SummaryCards
          balance={balance}
          income={income}
          expenses={expenses}
        />

        <TransactionsPanel
          transactions={filteredTransactions}
          totalCount={transactions.length}
          deletingId={deletingId}
          deleteError={deleteError}
          onDelete={handleDeleteTransaction}
          searchTerm={searchTerm}
          typeFilter={typeFilter}
          categoryFilter={categoryFilter}
          categories={categories}
          onSearchChange={setSearchTerm}
          onTypeChange={setTypeFilter}
          onCategoryChange={setCategoryFilter}
        />
      </main>
    </div>
  );
}

export default App;
