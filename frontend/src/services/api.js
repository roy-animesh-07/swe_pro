// Thin REST client for the JIS backend. All business decisions (CIN, slot vacancy,
// case status, charging) are made by the server; the client only displays results.

const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const TOKEN_KEY = 'jis.token';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized();
    throw new ApiError(
      res.status,
      data?.error || 'HTTP_ERROR',
      data?.message || `Request failed (${res.status}). Please try again.`
    );
  }
  return data;
}

const q = (params) => new URLSearchParams(params).toString();
const enc = encodeURIComponent;

export const api = {
  // Auth
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),

  // Users
  listUsers: () => request('GET', '/users'),
  createUser: (user) => request('POST', '/users', user),
  deleteUser: (username) => request('DELETE', `/users/${enc(username)}`),

  // Cases & hearings
  registerCase: (data) => request('POST', '/cases', data),
  getCase: (cin) => request('GET', `/cases/${enc(cin)}`),
  updateCase: (cin, data) => request('PUT', `/cases/${enc(cin)}`, data),
  availability: (date) => request('GET', `/hearings/availability?${q({ date })}`),
  scheduleHearing: (cin, hearingDate, timeSlot) => request('POST', `/cases/${enc(cin)}/hearings`, { hearingDate, timeSlot }),
  adjournHearing: (cin, hearingId, body) => request('POST', `/cases/${enc(cin)}/hearings/${enc(hearingId)}/adjourn`, body),
  completeHearing: (cin, hearingId, body) => request('POST', `/cases/${enc(cin)}/hearings/${enc(hearingId)}/complete`, body),
  closeCase: (cin, body) => request('POST', `/cases/${enc(cin)}/close`, body),

  // Queries
  pendingCases: () => request('GET', '/queries/pending-cases'),
  resolvedCases: (from, to) => request('GET', `/queries/resolved-cases?${q({ from, to })}`),
  hearingsOn: (date) => request('GET', `/queries/hearings?${q({ date })}`),
  caseStatus: (cin) => request('GET', `/queries/status/${enc(cin)}`),

  // Past cases
  searchPastCases: (keyword) => request('GET', `/past-cases/search?${q({ keyword })}`),
  viewPastCase: (cin) => request('POST', `/past-cases/${enc(cin)}/view`),
  getOutstandingCharge: () => request('GET', '/past-cases/charges'),
  payOutstandingCharge: () => request('POST', '/past-cases/pay'),
};
