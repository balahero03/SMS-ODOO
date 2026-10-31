const TOKEN_KEY = "sms_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null) => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY));

export async function api<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/v1${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  }).catch(() => {
    throw new Error("Can't reach the server. Check your connection and try again.");
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      // A slow reply for an old session mustn't sign out a newer one.
      if (getToken() === token) setToken(null);
      // /auth calls handle this themselves, so a stale session can't pull someone off a reset link.
      if (!path.startsWith("/auth/")) window.location.assign("/login");
    }
    throw new Error(data.message ?? "Something went wrong");
  }
  return data;
}

export const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
};
