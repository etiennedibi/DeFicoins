/* Thin fetch wrapper. Holds the session token, and surfaces the server's
   error message so screens can show something specific rather than "failed". */

const USER_KEY = 'deficoins.token';
const ADMIN_KEY = 'deficoins.admin';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => {
  try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {}
};

export const getToken = () => read(USER_KEY);
export const setToken = (t) => write(USER_KEY, t);
export const getAdminToken = () => read(ADMIN_KEY);
export const setAdminToken = (t) => write(ADMIN_KEY, t);

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(method, path, { body, admin } = {}) {
  const token = admin ? getAdminToken() : getToken();
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('Network unavailable. Check your connection.', 0);
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    if (res.status === 401) { admin ? setAdminToken(null) : setToken(null); }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get:  (p, o) => request('GET', p, o),
  post: (p, body, o) => request('POST', p, { ...o, body }),
};
