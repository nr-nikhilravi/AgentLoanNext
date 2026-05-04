// Tiny API client used by every view. Centralises:
//  - credential-cookie handling (always send cookies)
//  - JSON parsing + error throwing
//  - the four agentic endpoints
//
// On 401 from any call, we redirect to the right login page.

const J = "application/json";

function loginPathForRole(role) {
  return role === "customer" ? "/login/customer" : "/login/rm";
}

function bounceTo(path) {
  if (typeof window !== "undefined" && window.location.pathname !== path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

async function request(path, { method = "GET", body, expectAuth = true, role = "rm" } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": J } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && expectAuth) {
    bounceTo(loginPathForRole(role));
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Auth
  loginRM:       (id, password) => request("/api/auth/login/rm", { method: "POST", body: { id, password }, expectAuth: false }),
  loginCustomer: (username, password) => request("/api/auth/login/customer", { method: "POST", body: { username, password }, expectAuth: false }),
  loginAdmin:    (id, password) => request("/api/auth/login/admin", { method: "POST", body: { id, password }, expectAuth: false }),
  logout:        () => request("/api/auth/logout", { method: "POST", expectAuth: false }),
  whoami:        () => request("/api/auth/me", { expectAuth: false }),

  // RM cockpit
  bank:          () => fetch("/api/bank").then(r => r.json()),
  portfolio:     () => request("/api/portfolio"),
  spotlight:     () => request("/api/leadgen/spotlight"),
  research:      (companyId, force = false) => request(`/api/research/${companyId}${force ? "?force=true" : ""}`),
  researchSource:(companyId, source) => request(`/api/research/${companyId}?source=${encodeURIComponent(source)}`),
  adminVault:    () => request("/api/admin/vault"),

  // v5 — Admin Command Center
  adminInitiateBatch:  () => request("/api/admin/initiate-batch", { method: "POST" }),
  adminBatchStatus:    (jobId) => request(`/api/admin/batch/${jobId}`),
  adminBatchLatest:    () => request("/api/admin/batch/latest"),

  // Underwriting flow
  score:         (req) => request("/api/underwrite/score", { method: "POST", body: req }),
  kfs:           (req) => request("/api/compliance/kfs", { method: "POST", body: req }),
  disburse:      (req) => request("/api/disburse", { method: "POST", body: req }),

  // MSME portal
  esign:         (req) => request("/api/esign", { method: "POST", body: req, role: "customer" }),

  // SSE
  traceUrl:      "/api/agents/trace",

  // Voice Copilot — multipart audio upload
  voiceCommand:  async (blob, mime, researched) => {
    const fd = new FormData();
    fd.append("audio", blob, `command.${(mime || "audio/webm").split("/")[1].split(";")[0]}`);
    fd.append("researched_csv", Array.from(researched || []).join(","));
    const res = await fetch("/api/voice/command", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (res.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.history.pushState({}, "", "/login/rm");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      throw new Error("Not authenticated");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
  },
};

// Tiny client-side router: just listens to popstate and renders based on pathname.
export function usePath() {
  const [path, setPath] = (typeof window !== "undefined" && typeof React !== "undefined" && React.useState)
    ? React.useState(window.location.pathname)
    : ["/", () => {}];
  return [path, setPath];
}

export function navigate(path) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
