function DashboardHeader({ name, onAddIncome, onAddExpense }) {
  return (
    <header className="dashboard-header">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" focusable="false">
              <path
                className="brand-bars"
                d="M14 48V35h8v13h-8Zm14 0V26h8v22h-8Zm14 0V16h8v32h-8Z"
              />
              <path
                className="brand-line"
                d="m14 29 12-9 9 4 15-12"
              />
            </svg>
          </div>
          <strong className="brand-name">Finance Dashboard</strong>
        </div>

        <div className="profile">
          <div className="profile-copy">
            <span>Willkommen zurück</span>
            <strong>{name}</strong>
          </div>
          <div className="avatar">T</div>
        </div>
      </div>

      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Finanzübersicht</p>
          <h1>Dashboard</h1>
          <p className="dashboard-intro">
            Behalte Kontostand, Einnahmen und Ausgaben im Blick.
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            className="dashboard-action income-action"
            type="button"
            onClick={onAddIncome}
          >
            <span aria-hidden="true">+</span>
            Einnahme hinzufügen
          </button>
          <button
            className="dashboard-action expense-action"
            type="button"
            onClick={onAddExpense}
          >
            <span aria-hidden="true">−</span>
            Ausgabe hinzufügen
          </button>
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
