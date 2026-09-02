function TransactionFilters({
  searchTerm,
  typeFilter,
  categoryFilter,
  categories,
  onSearchChange,
  onTypeChange,
  onCategoryChange,
}) {
  return (
    <div className="filter-bar">
      <label className="search-field">
        Transaktionen durchsuchen
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Name, Kategorie, Zweck ..."
        />
      </label>

      <label>
        Typ
        <select
          value={typeFilter}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          <option value="all">Alle</option>
          <option value="income">Einnahmen</option>
          <option value="expense">Ausgaben</option>
        </select>
      </label>

      <label>
        Kategorie
        <select
          value={categoryFilter}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="all">Alle Kategorien</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default TransactionFilters;
