function DashboardHeader({ name, onAddIncome, onAddExpense }) {
  return (
    <header className="dashboard-header">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <strong className="brand-name">Finance Dashboard</strong>
        </div>

        <div className="profile">
          <div className="profile-copy">
            <span>Willkommen zurück</span>
            <strong>{name}</strong>
          </div>
          <div className="avatar">TW</div>
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
