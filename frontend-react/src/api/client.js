let tokenProvider = () => null;
let logoutHandler = null;

export const setTokenProvider = (fn) => {
  tokenProvider = fn;
};

export const setLogoutHandler = (fn) => {
  logoutHandler = fn;
};

async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenProvider();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, { ...options, headers });

  if (response.status === 401) {
    if (logoutHandler) logoutHandler();
    return null;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export function get(endpoint) {
  return api(endpoint);
}

export function post(endpoint, body) {
  return api(endpoint, { method: 'POST', body: JSON.stringify(body) });
}

export function put(endpoint, body) {
  return api(endpoint, { method: 'PUT', body: JSON.stringify(body) });
}

export function patch(endpoint, body) {
  return api(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
}

export function del(endpoint) {
  return api(endpoint, { method: 'DELETE' });
}
