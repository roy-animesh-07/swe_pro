import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.jsx';
import App from '../App.jsx';

/** Render the whole app at `path`, logged in as `user` (or logged out when null). */
export function renderApp(path, { user = null, api } = {}) {
  if (user) {
    localStorage.setItem('jis.token', 'test-token');
    api.me.mockResolvedValue(user);
  }
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

export const REGISTRAR = { username: 'registrar', name: 'Court Registrar', role: 'REGISTRAR' };
export const JUDGE = { username: 'judge1', name: 'Justice Rao', role: 'JUDGE' };
export const LAWYER = { username: 'lawyer1', name: 'Adv. Gupta', role: 'LAWYER' };
