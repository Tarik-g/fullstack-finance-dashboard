import TransactionFilters from "./TransactionFilters";

function DashboardFilters({
  searchTerm,
  typeFilter,
  categoryFilter,
  categories,
  filteredCount,
  totalCount,
  hasActiveFilters,
  periodMode,
  selectedPeriod,
  availableYears,
  onSearchChange,
  onTypeChange,
  onCategoryChange,
  onPeriodModeChange,
  onYearChange,
  onMonthChange,
  onReset,
}) {
  const selectedYear = selectedPeriod.slice(0, 4);
  const selectedMonth = selectedPeriod.slice(5, 7);

  return (
    <section className="panel filter-panel" aria-labelledby="filter-heading">
      <div className="section-heading filter-heading">
        <div>
          <p className="eyebrow">Ansicht</p>
          <h2 id="filter-heading">Dashboard filtern</h2>
        </div>

        <div className="filter-summary">
          <span className="transaction-count">
            {filteredCount} von {totalCount} Buchungen
          </span>
          <button
            className="filter-reset"
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            Filter zurücksetzen
          </button>
        </div>
      </div>

      <TransactionFilters
        searchTerm={searchTerm}
        typeFilter={typeFilter}
        categoryFilter={categoryFilter}
        categories={categories}
        onSearchChange={onSearchChange}
        onTypeChange={onTypeChange}
        onCategoryChange={onCategoryChange}
      />

      <div className="period-filter">
        <div className="period-mode-field">
          <span>Zeitraum</span>
          <div
            className="period-tabs"
            role="group"
            aria-label="Zeitraum auswählen"
          >
            {[
              ["all", "Gesamt"],
              ["year", "Jahr"],
              ["month", "Monat"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={periodMode === value ? "is-active" : ""}
                type="button"
                aria-pressed={periodMode === value}
                onClick={() => onPeriodModeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {periodMode !== "all" && (
          <div className="period-pickers">
            {periodMode === "month" && (
              <label>
                Monat
                <select
                  value={selectedMonth}
                  onChange={(event) => onMonthChange(event.target.value)}
                >
                  <option value="01">Januar</option>
                  <option value="02">Februar</option>
                  <option value="03">März</option>
                  <option value="04">April</option>
                  <option value="05">Mai</option>
                  <option value="06">Juni</option>
                  <option value="07">Juli</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Dezember</option>
                </select>
              </label>
            )}

            <label>
              Jahr
              <select
                value={selectedYear}
                onChange={(event) => onYearChange(event.target.value)}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}

export default DashboardFilters;
