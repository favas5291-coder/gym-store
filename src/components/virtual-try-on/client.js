export const ENDPOINT = "/api/virtual-try-on";
export async function request(
  action,
  { method = "GET", id, body, csrf = "", signal } = {},
) {
  const query = new URLSearchParams({ action, ...(id ? { id } : {}) });
  let response;
  try {
    response = await fetch(`${ENDPOINT}?${query}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        method === "GET"
          ? {}
          : { "Content-Type": "application/json", "X-GymDrobe-Token": csrf },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Your connection was interrupted. Check your connection and try again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Virtual Try-On is not connected yet. Please try again later.",
    );
  }
  if (!response.ok)
    throw new Error(
      data.message || "Virtual Try-On is temporarily unavailable.",
    );
  return data;
}
export const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
export function discard(id, csrf) {
  if (id && csrf)
    fetch(`${ENDPOINT}?action=job&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
      keepalive: true,
      headers: { "X-GymDrobe-Token": csrf },
    }).catch(() => {});
}