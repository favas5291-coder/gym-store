const API_URL = String(import.meta.env?.VITE_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");
export function notificationApi(token, { request = fetch } = {}) {
  const call = async (method, body) => {
    const response = await request(API_URL + "/notifications/devices", {
      method, cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok || result.success !== true) throw new Error("Notification settings could not be saved.");
    return result;
  };
  return { read: () => call("GET"), register: value => call("POST", value), disable: value => call("DELETE", value) };
}
