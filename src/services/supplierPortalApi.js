const API_URL = (import.meta.env?.VITE_API_URL || "http://localhost:5000/api").trim().replace(/\/+$/, "");

export class SupplierPortalError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SupplierPortalError";
    Object.assign(this, details);
  }
}

const identifier = (value) => {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) throw new SupplierPortalError("Choose a supplier record.");
  return encodeURIComponent(value);
};

export function createSupplierPortalApi({ baseUrl = API_URL, fetchImpl = globalThis.fetch } = {}) {
  async function request(token, path, { method = "GET", body, signal, timeoutMs = 20000 } = {}) {
    if (typeof token !== "string" || !token.trim()) throw new SupplierPortalError("Sign in to continue.", { status: 401 });
    const writing = method !== "GET";
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new DOMException("Request cancelled.", "AbortError");
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/supplier-portal${path}`, {
        method, cache: "no-store", signal: controller.signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      let data;
      try { data = await response.json(); } catch { /* Fail closed on incomplete replies. */ }
      if (!response.ok || data?.success !== true) {
        throw new SupplierPortalError(data?.message || "The supplier request could not be confirmed.", {
          status: response.status, code: data?.code, outcomeUnknown: writing && (response.ok || response.status >= 500),
        });
      }
      const needsWorkspace = writing || path === "/me" || /^\/admin\/workspaces\/[a-f0-9]{24}$/i.test(path);
      if ((needsWorkspace || data.workspace) && (!data.workspace || typeof data.workspace.id !== "string" || !/^[a-f0-9]{24}$/i.test(data.workspace.id) ||
        !Number.isSafeInteger(data.workspace.revision) || data.workspace.revision < 0)) {
        throw new SupplierPortalError("The saved supplier record was incomplete. Reload it.", { outcomeUnknown: writing });
      }
      return data;
    } catch (error) {
      if (error instanceof SupplierPortalError) throw error;
      if (signal?.aborted && !writing) throw error;
      throw new SupplierPortalError("The connection was interrupted. Reload the record to confirm what was saved.", { outcomeUnknown: writing });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  const write = (token, path, body, method = "POST") => request(token, path, { body, method });
  return {
    me: (token, options) => request(token, "/me", options),
    apply: (token, profile) => write(token, "/applications", { profile }),
    updateProfile: (token, revision, profile) => write(token, "/me/profile", { revision, profile }, "PUT"),
    claim: (token, code) => write(token, "/invitations/claim", { code }),
    accept: (token, body) => write(token, "/me/accept-terms", body),
    history: (token, options) => request(token, "/me/history", options),
    list: (token, { page = 1, status = "", ...options } = {}) => request(token, `/admin/workspaces?${new URLSearchParams({ page, status })}`, options),
    get: (token, id, options) => request(token, `/admin/workspaces/${identifier(id)}`, options),
    invite: (token, body, id) => write(token, id ? `/admin/workspaces/${identifier(id)}/invitation` : "/admin/invitations", body),
    offer: (token, id, revision, terms) => write(token, `/admin/workspaces/${identifier(id)}/terms`, { revision, terms }),
    status: (token, id, revision, status, reason) => write(token, `/admin/workspaces/${identifier(id)}/status`, { revision, status, reason }, "PATCH"),
    adminHistory: (token, id, options) => request(token, `/admin/workspaces/${identifier(id)}/history`, options),
  };
}

export const supplierPortalApi = createSupplierPortalApi();

export function commissionBps(value) {
  if (typeof value !== "string" || !/^\d{1,3}(?:\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a commission percentage with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (result > 10000) throw new Error("Commission cannot exceed 100%.");
  return result;
}
