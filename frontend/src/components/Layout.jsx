import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = {
  REGISTRAR: [
    { to: '/registrar/queries/pending', label: 'Pending cases' },
    { to: '/registrar/cases/new', label: 'Register case' },
    { to: '/registrar/cases', label: 'Manage case', end: true },
    { to: '/registrar/queries/hearings', label: 'Hearings by date' },
    { to: '/registrar/queries/resolved', label: 'Resolved cases' },
    { to: '/registrar/queries/status', label: 'Case status' },
    { to: '/registrar/users', label: 'Users' },
  ],
  JUDGE: [{ to: '/judge/past-cases', label: 'Search old cases' }],
  LAWYER: [{ to: '/lawyer/past-cases', label: 'Search old cases' }],
};

const ROLE_LABEL = { REGISTRAR: 'Registrar', JUDGE: 'Judge', LAWYER: 'Lawyer' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">⚖</span>
          <span>JIS</span>
        </div>
        <nav className="nav" aria-label="Main">
          {(NAV[user.role] || []).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <span className="user-name">
            {user.name} <span className="muted">· {ROLE_LABEL[user.role]}</span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
