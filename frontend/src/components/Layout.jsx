import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

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
  const [balance, setBalance] = useState(0);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (user.role === 'LAWYER') {
      const fetchBalance = () => {
        api.getOutstandingCharge().then((res) => setBalance(res.total)).catch(console.error);
      };
      fetchBalance();
      window.addEventListener('charge-added', fetchBalance);
      return () => window.removeEventListener('charge-added', fetchBalance);
    }
  }, [user.role]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function handlePay() {
    if (!window.confirm(`Are you sure you want to pay the pending amount of ₹${balance.toFixed(2)}?`)) {
      return;
    }
    setPaying(true);
    try {
      await api.payOutstandingCharge();
      setBalance(0);
      alert('Payment successful!');
    } catch (e) {
      console.error(e);
      alert('Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
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
          {user.role === 'LAWYER' && balance > 0 && (
            <span className="balance-info" style={{ marginRight: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Pending: ₹{balance.toFixed(2)}
              <button 
                type="button" 
                className="btn btn-sm" 
                onClick={handlePay}
                disabled={paying}
              >
                {paying ? 'Paying...' : 'Pay'}
              </button>
            </span>
          )}
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
