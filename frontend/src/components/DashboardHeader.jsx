function DashboardHeader({ name }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <p className="eyebrow">Finance Dashboard</p>
          <h1>Meine Finanzen</h1>
        </div>
      </div>

      <div className="profile">
        <div className="profile-copy">
          <span>Willkommen zurück</span>
          <strong>{name}</strong>
        </div>
        <div className="avatar">TW</div>
      </div>
    </header>
  );
}

export default DashboardHeader;
