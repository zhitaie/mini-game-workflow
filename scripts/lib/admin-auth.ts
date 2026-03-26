export const DEV_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'dev-admin-password'
};

export async function loginAdmin(options: {
  baseURL: string;
  fetchImpl?: typeof fetch;
  credentials?: {
    username: string;
    password: string;
  };
}): Promise<{
  session: {
    token: string;
    expiresAt: number;
  };
  adminUser: {
    username: string;
    roleCode: string;
  };
}> {
  const response = await (options.fetchImpl ?? fetch)(new URL('/api/admin/auth/login', options.baseURL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options.credentials ?? DEV_ADMIN_CREDENTIALS)
  });
  const payload = (await response.json()) as {
    success: boolean;
    data?: {
      session: {
        token: string;
        expiresAt: number;
      };
      adminUser: {
        username: string;
        roleCode: string;
      };
    };
  };

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(`Admin login failed: ${JSON.stringify(payload)}`);
  }

  return payload.data;
}
