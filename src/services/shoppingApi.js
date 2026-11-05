const API_URL = String(import.meta.env?.VITE_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");

export function shoppingApi(token, { request = fetch } = {}) {
  const call = async (path, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await request(API_URL + "/shopping-state" + path, {
        method: body ? "POST" : "GET", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw Object.assign(new Error(data.message || "Your shopping lists could not sync."), { status: response.status, code: data.code, data });
      return data;
    } finally { clearTimeout(timer); }
  };
  return { read: () => call(""), mutate: operation => call("/operations", operation) };
}
