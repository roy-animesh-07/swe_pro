import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorMessage, Field, PageHeader, SuccessMessage, EmptyState, Spinner } from '../../components/common.jsx';

const EMPTY = { username: '', name: '', password: '', role: 'LAWYER' };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError(err);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleCreate(e) {
    e.preventDefault();
    const errs = {};
    if (!form.username.trim()) errs.username = 'Required';
    if (!form.name.trim()) errs.name = 'Required';
    if (form.password.length < 6) errs.password = 'At least 6 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api.createUser({ ...form, username: form.username.trim(), name: form.name.trim() });
      setSuccess(`Account "${created.username}" created.`);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(username) {
    if (!window.confirm(`Delete the account "${username}"? The user will no longer be able to log in.`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api.deleteUser(username);
      setSuccess(`Account "${username}" deleted.`);
      load();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <PageHeader title="User accounts" subtitle="Create and delete accounts for registrars, judges and lawyers." />
      <ErrorMessage error={error} />
      <SuccessMessage>{success}</SuccessMessage>
      <div className="grid-2">
        <form className="card" onSubmit={handleCreate} noValidate>
          <h2>New account</h2>
          <Field label="Username" error={errors.username}>
            <input value={form.username} onChange={set('username')} autoComplete="off" />
          </Field>
          <Field label="Full name" error={errors.name}>
            <input value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Password" error={errors.password}>
            <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={set('role')}>
              <option value="REGISTRAR">Registrar</option>
              <option value="JUDGE">Judge</option>
              <option value="LAWYER">Lawyer</option>
            </select>
          </Field>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <section className="card">
          <h2>Existing accounts</h2>
          {!users ? (
            <Spinner />
          ) : users.length === 0 ? (
            <EmptyState>No accounts.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.username}>
                      <td className="mono">{u.username}</td>
                      <td>{u.name}</td>
                      <td>{u.role}</td>
                      <td className="right">
                        {u.username !== me.username && (
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(u.username)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
