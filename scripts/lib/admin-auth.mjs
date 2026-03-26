export const DEV_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'dev-admin-password'
};

export async function loginAdmin({ baseURL, fetchImpl = fetch, credentials = DEV_ADMIN_CREDENTIALS }) {
  const response = await fetchImpl(new URL('/api/admin/auth/login', baseURL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(`Admin login failed: ${JSON.stringify(payload)}`);
  }

  return payload.data;
}
