export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⚡</div>
          <div className="brand-text">
            ParkShare & Charge
            <span>Tamal Deb Nath</span>
          </div>
        </div>
        <div className="nav-eyebrow">Module 1</div>
        <div className="nav-link active">
          <span className="num">01</span>
          Geospatial Search
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
