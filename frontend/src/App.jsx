import { useEffect, useState } from "react";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "./api/financeApi";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import DashboardHeader from "./components/DashboardHeader";
import DashboardFilters from "./components/DashboardFilters";
import SummaryCards from "./components/SummaryCards";
import TransactionModal from "./components/TransactionModal";
import TransactionsPanel from "./components/TransactionsPanel";
import useDashboardData from "./hooks/useDashboardData";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState("booking_date");
  const [sortDirection, setSortDirection] = useState("desc");
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
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    if (searchTerm === debouncedSearch) return;

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm, debouncedSearch]);

  const {
    metadata,
    transactions: pageRequest,
    analytics: analyticsRequest,
  } = useDashboardData({
    filters: {
      search: debouncedSearch.trim() || undefined,
      transaction_type: typeFilter,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      year: periodMode === "all" ? undefined : selectedPeriod.slice(0, 4),
      month:
        periodMode === "month" ? Number(selectedPeriod.slice(5, 7)) : undefined,
    },
    page: currentPage,
    sortField,
    sortDirection,
    granularity: periodMode === "month" ? "day" : "month",
    version: dataVersion,
  });

  const summary = metadata.data?.summary;
  const categories = metadata.data?.categories ?? [];
  const availableYears = metadata.data?.years ?? [];
  const pageData = pageRequest.data;
  const transactions = pageData?.items ?? [];
  const filteredCount = pageData?.total ?? 0;
  const isSearchPending = searchTerm !== debouncedSearch;
  const isPageLoading = pageRequest.isLoading || isSearchPending;
  const isAnalyticsLoading = analyticsRequest.isLoading || isSearchPending;
  const errors = [
    metadata.error,
    pageRequest.error,
    analyticsRequest.error,
  ].filter(Boolean);

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
    setDebouncedSearch("");
    setTypeFilter("all");
    setCategoryFilter("all");
    setPeriodMode("all");
    setCurrentPage(1);
  }

  function handleSearchChange(value) {
    setSearchTerm(value);
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

  if (!metadata.data && metadata.isLoading) {
    return <div className="state-screen">Transaktionen werden geladen ...</div>;
  }

  return (
    <div className="app-shell">
      <DashboardHeader
        name={name}
        onAddIncome={() => handleOpenTransactionForm("income")}
        onAddExpense={() => handleOpenTransactionForm("expense")}
      />

      <main className="dashboard-content">
        {errors.length > 0 && (
          <div className="panel" role="alert">
            <p>{[...new Set(errors)].join(" · ")}</p>
            <button
              type="button"
              onClick={() => setDataVersion((version) => version + 1)}
            >
              Erneut laden
            </button>
          </div>
        )}

        {metadata.isLoading ? (
          <p className="panel" role="status">
            Kennzahlen werden aktualisiert …
          </p>
        ) : summary ? (
          <SummaryCards
            balance={summary.balance}
            income={summary.income}
            expenses={summary.expenses}
          />
        ) : (
          <p className="panel">Kennzahlen derzeit nicht verfügbar.</p>
        )}

        <DashboardFilters
          searchTerm={searchTerm}
          typeFilter={typeFilter}
          categoryFilter={categoryFilter}
          categories={categories}
          filteredCount={filteredCount}
          totalCount={summary?.transactionCount ?? 0}
          isLoading={isPageLoading}
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

        {analyticsRequest.error ? (
          <p className="panel">Diagramme konnten nicht geladen werden.</p>
        ) : (
          <AnalyticsDashboard
            timeline={analyticsRequest.data?.timeline ?? []}
            categories={analyticsRequest.data?.categories ?? []}
            periodMode={periodMode}
            isLoading={isAnalyticsLoading}
          />
        )}

        <TransactionsPanel
          transactions={transactions}
          filteredCount={filteredCount}
          totalCount={summary?.transactionCount ?? 0}
          currentPage={pageData?.page ?? currentPage}
          totalPages={pageData?.totalPages ?? 1}
          pageSize={pageData?.pageSize ?? 10}
          isLoading={isPageLoading}
          loadError={pageRequest.error}
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
