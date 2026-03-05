const BASE_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function readError(res) {
  const data = await res.json().catch(() => ({}));
  return data?.detail || data?.message || "Request failed";
}

/** Google Login */
export async function googleLogin(idToken) {
  const res = await fetch(`${BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** Update optional profile */
export async function updateProfile(data) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** Get current user */
export async function getMe() {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}