import { useEffect, useRef, useState } from "react";
import {
  createTransaction,
  deleteTransaction,
  getCategories,
  getTransactions,
  updateTransaction,
} from "./api/financeApi";
import DashboardHeader from "./components/DashboardHeader";
import SummaryCards from "./components/SummaryCards";
import TransactionModal from "./components/TransactionModal";
import TransactionsPanel from "./components/TransactionsPanel";

function getLocalDateString() {
  const now = new Date();
  const localTime = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function createEmptyTransactionForm() {
  return {
    bookingDate: getLocalDateString(),
    counterparty: "",
    iban: "",
    purpose: "",
    amount: "",
    category: "",
    status: "Gebucht",
  };
}

function App() {
  const modalScrollPositionRef = useRef(0);
  const [name] = useState("Tarik");
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactionForm, setTransactionForm] = useState(
    createEmptyTransactionForm,
  );
  const [transactionMode, setTransactionMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
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

  function resetTransactionForm() {
    setTransactionForm(createEmptyTransactionForm());
    setTransactionMode(null);
    setEditingId(null);
    setFormError(null);
  }

  function handleOpenTransactionForm(mode) {
    modalScrollPositionRef.current = window.scrollY;
    setTransactionForm(createEmptyTransactionForm());
    setTransactionMode(mode);
    setEditingId(null);
    setFormError(null);
  }

  function handleTransactionFieldChange(field, value) {
    setTransactionForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleEditTransaction(transaction) {
    modalScrollPositionRef.current = window.scrollY;
    setEditingId(transaction.id);
    setTransactionMode("edit");
    setTransactionForm({
      bookingDate: transaction.bookingDate,
      counterparty: transaction.counterparty,
      iban: transaction.iban || "",
      purpose: transaction.purpose || "",
      amount: String(transaction.amount).replace(".", ","),
      category: transaction.category || "",
      status: transaction.status || "",
    });
    setFormError(null);
  }

  async function handleSubmitTransaction(event) {
    event.preventDefault();
    setFormError(null);

    const normalizedName = transactionForm.counterparty.trim();
    const enteredAmount = Number(transactionForm.amount.replace(",", "."));

    if (!transactionForm.bookingDate) {
      setFormError("Bitte wähle ein Datum aus.");
      return;
    }

    if (!normalizedName) {
      setFormError("Bitte gib einen Namen ein.");
      return;
    }

    if (!transactionForm.amount.trim() || !Number.isFinite(enteredAmount)) {
      setFormError("Bitte gib einen gültigen Betrag ein.");
      return;
    }

    let normalizedAmount = enteredAmount;

    if (editingId === null) {
      normalizedAmount =
        transactionMode === "expense"
          ? -Math.abs(enteredAmount)
          : Math.abs(enteredAmount);
    }

    setIsSubmitting(true);

    try {
      const transactionData = {
        bookingDate: transactionForm.bookingDate,
        counterparty: normalizedName,
        iban: transactionForm.iban.trim(),
        purpose: transactionForm.purpose.trim(),
        amount: normalizedAmount,
        category: transactionForm.category,
        status: transactionForm.status.trim(),
      };

      if (editingId === null) {
        await createTransaction(transactionData);
      } else {
        await updateTransaction(editingId, transactionData);
      }

      resetTransactionForm();
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

      if (editingId === id) {
        resetTransactionForm();
      }

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
      <DashboardHeader
        name={name}
        onAddIncome={() => handleOpenTransactionForm("income")}
        onAddExpense={() => handleOpenTransactionForm("expense")}
      />

      <main className="dashboard-content">
        <SummaryCards
          balance={balance}
          income={income}
          expenses={expenses}
        />

        <TransactionsPanel
          transactions={filteredTransactions}
          totalCount={transactions.length}
          editingId={editingId}
          deletingId={deletingId}
          deleteError={deleteError}
          onEdit={handleEditTransaction}
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

      {transactionMode !== null && (
        <TransactionModal
          transaction={transactionForm}
          categories={categories}
          transactionMode={transactionMode}
          scrollPosition={modalScrollPositionRef.current}
          isSubmitting={isSubmitting}
          isEditing={editingId !== null}
          error={formError}
          onFieldChange={handleTransactionFieldChange}
          onSubmit={handleSubmitTransaction}
          onClose={resetTransactionForm}
        />
      )}
    </div>
  );
}

export default App;
