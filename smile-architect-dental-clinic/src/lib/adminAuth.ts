const ADMIN_TOKEN_STORAGE_KEY = 'sadc_admin_token';
let inMemoryToken: string | null = null;

export function getAdminToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const stored = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (stored) {
      inMemoryToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage access errors in restricted sandboxed iframes
  }
  return null;
}

export function setAdminToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted sandboxed iframes
  }
}

export function clearAdminToken(): void {
  setAdminToken(null);
}

export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAdminToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export async function downloadAdminFile(url: string, fallbackFilename: string): Promise<void> {
  const res = await adminFetch(url);
  if (!res.ok) {
    throw new Error('Unable to download file.');
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || fallbackFilename;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
