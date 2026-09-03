import { useEffect, useState } from "react";
import {
  createTransaction,
  deleteTransaction,
  getAvailableYears,
  getCategories,
  getCategoryTotals,
  getFinancialSummary,
  getTimeline,
  getTransactions,
  updateTransaction,
} from "./api/financeApi";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import DashboardHeader from "./components/DashboardHeader";
import DashboardFilters from "./components/DashboardFilters";
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
  const [name] = useState("Tarik");
  const [transactions, setTransactions] = useState([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState("booking_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [summary, setSummary] = useState({
    transactionCount: 0,
    income: 0,
    expenses: 0,
    balance: 0,
  });
  const [timeline, setTimeline] = useState([]);
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactionForm, setTransactionForm] = useState(
    createEmptyTransactionForm,
  );
  const [transactionMode, setTransactionMode] = useState(null);
  const [modalScrollPosition, setModalScrollPosition] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [periodMode, setPeriodMode] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState(() =>
    getLocalDateString().slice(0, 7),
  );
  const [categories, setCategories] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    let isCurrentRequest = true;

    Promise.all([
      getFinancialSummary(),
      getCategories(),
      getAvailableYears(),
    ])
      .then(([summaryData, categoryData, yearData]) => {
        if (!isCurrentRequest) {
          return;
        }

        setSummary(summaryData);
        setCategories(categoryData);
        setAvailableYears(yearData);
      })
      .catch((requestError) => {
        console.error(requestError);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [dataVersion]);

  useEffect(() => {
    let isCurrentRequest = true;
    const selectedYear = selectedPeriod.slice(0, 4);
    const selectedMonth = Number(selectedPeriod.slice(5, 7));
    const filterParameters = {
      search: debouncedSearch.trim() || undefined,
      transaction_type: typeFilter,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      year: periodMode === "all" ? undefined : selectedYear,
      month: periodMode === "month" ? selectedMonth : undefined,
    };

    Promise.all([
      getTransactions({
        ...filterParameters,
        page: currentPage,
        page_size: 10,
        sort_by: sortField,
        sort_direction: sortDirection,
      }),
      getTimeline({
        ...filterParameters,
        granularity: periodMode === "month" ? "day" : "month",
      }),
      getCategoryTotals(filterParameters),
    ])
      .then(([pageData, timelineData, categoryData]) => {
        if (!isCurrentRequest) {
          return;
        }

        setTransactions(pageData.items);
        setFilteredCount(pageData.total);
        setTotalPages(pageData.totalPages);
        setTimeline(timelineData);
        setCategoryTotals(categoryData);
        setError(null);

        if (pageData.page !== currentPage) {
          setCurrentPage(pageData.page);
        }
      })
      .catch((requestError) => {
        if (isCurrentRequest) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [
    categoryFilter,
    currentPage,
    dataVersion,
    debouncedSearch,
    periodMode,
    selectedPeriod,
    sortDirection,
    sortField,
    typeFilter,
  ]);

  function resetTransactionForm() {
    setTransactionForm(createEmptyTransactionForm());
    setTransactionMode(null);
    setEditingId(null);
    setFormError(null);
  }

  function handleOpenTransactionForm(mode) {
    setModalScrollPosition(window.scrollY);
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
    setModalScrollPosition(window.scrollY);
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
      setDataVersion((currentVersion) => currentVersion + 1);
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

      setDataVersion((currentVersion) => currentVersion + 1);
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  const selectedYear = selectedPeriod.slice(0, 4);
  const displayedYears = availableYears.includes(selectedYear)
    ? availableYears
    : [...availableYears, selectedYear].sort((first, second) =>
        second.localeCompare(first),
      );
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    typeFilter !== "all" ||
    categoryFilter !== "all" ||
    periodMode !== "all";

  function handleResetFilters() {
    setSearchTerm("");
    setTypeFilter("all");
    setCategoryFilter("all");
    setPeriodMode("all");
    setCurrentPage(1);
  }

  function handleSearchChange(value) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  function handleTypeChange(value) {
    setTypeFilter(value);
    setCurrentPage(1);
  }

  function handleCategoryChange(value) {
    setCategoryFilter(value);
    setCurrentPage(1);
  }

  function handlePeriodModeChange(value) {
    setPeriodMode(value);
    setCurrentPage(1);
  }

  function handleYearChange(year) {
    setSelectedPeriod(
      (currentPeriod) => `${year}-${currentPeriod.slice(5, 7)}`,
    );
    setCurrentPage(1);
  }

  function handleMonthChange(month) {
    setSelectedPeriod(
      (currentPeriod) => `${currentPeriod.slice(0, 4)}-${month}`,
    );
    setCurrentPage(1);
  }

  function handleSortChange(field, direction) {
    setSortField(field);
    setSortDirection(direction);
    setCurrentPage(1);
  }

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
          balance={summary.balance}
          income={summary.income}
          expenses={summary.expenses}
        />

        <DashboardFilters
          searchTerm={searchTerm}
          typeFilter={typeFilter}
          categoryFilter={categoryFilter}
          categories={categories}
          filteredCount={filteredCount}
          totalCount={summary.transactionCount}
          hasActiveFilters={hasActiveFilters}
          periodMode={periodMode}
          selectedPeriod={selectedPeriod}
          availableYears={displayedYears}
          onSearchChange={handleSearchChange}
          onTypeChange={handleTypeChange}
          onCategoryChange={handleCategoryChange}
          onPeriodModeChange={handlePeriodModeChange}
          onYearChange={handleYearChange}
          onMonthChange={handleMonthChange}
          onReset={handleResetFilters}
        />

        <AnalyticsDashboard
          timeline={timeline}
          categories={categoryTotals}
          periodMode={periodMode}
        />

        <TransactionsPanel
          transactions={transactions}
          filteredCount={filteredCount}
          totalCount={summary.transactionCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={10}
          sortField={sortField}
          sortDirection={sortDirection}
          editingId={editingId}
          deletingId={deletingId}
          deleteError={deleteError}
          onPageChange={setCurrentPage}
          onSortChange={handleSortChange}
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
        />
      </main>

      {transactionMode !== null && (
        <TransactionModal
          transaction={transactionForm}
          categories={categories}
          transactionMode={transactionMode}
          scrollPosition={modalScrollPosition}
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
