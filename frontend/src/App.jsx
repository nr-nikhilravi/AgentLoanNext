import React, { useEffect, useState } from "react";
import { LayoutDashboard, FileSignature, Lock, LogOut, Bell } from "lucide-react";
import Logo from "./Logo.jsx";
import { api, navigate } from "./api.js";
import { RMLogin, CustomerLogin } from "./Login.jsx";
import AdminLogin from "./AdminLogin.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import RMCockpit from "./RMCockpit.jsx";
import MSMEPortal from "./MSMEPortal.jsx";
import Research from "./Research.jsx";
import AdminVault from "./AdminVault.jsx";
import VoiceCopilot from "./VoiceCopilot.jsx";

/**
 * App-level path router. Supports:
 *   /login/rm        →  RMLogin
 *   /login/customer  →  CustomerLogin
 *   /rm-dashboard    →  RMCockpit  (requires session.role==="rm")
 *   /research/:id    →  Research   (requires session.role==="rm")
 *   /admin/vault     →  AdminVault (requires session.role==="rm")
 *   /msme-portal     →  MSMEPortal (requires session.role==="customer")
 *   /                →  redirects to /login/rm
 */
export default function App() {
  const [path, setPath] = useState(typeof window !== "undefined" ? window.location.pathname : "/");
  const [session, setSession] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [researchedSet, setResearchedSet] = useState(() => new Set());

  // Listen to popstate (browser back/forward + our navigate())
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Bootstrap session on first render
  useEffect(() => {
    api.whoami()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setBootstrapped(true));
  }, []);

  if (!bootstrapped) return <Booting />;

  // Route resolver
  if (path.startsWith("/login/rm"))        return <RMLogin />;
  if (path.startsWith("/login/customer"))  return <CustomerLogin />;
  if (path.startsWith("/login/admin"))     return <AdminLogin />;

  // Anything else needs a session
  if (!session) {
    // route the user to the right login automatically
    if (path.startsWith("/msme-portal")) return <CustomerLogin />;
    if (path.startsWith("/admin-dashboard")) return <AdminLogin />;
    return <RMLogin />;
  }

  const markResearched = (id) =>
    setResearchedSet((s) => new Set(s).add(id));

  const loginPathForRole = (r) =>
    r === "customer" ? "/login/customer" : r === "admin" ? "/login/admin" : "/login/rm";

  const shellProps = {
    session,
    onLogout: async () => {
      const r = session.role;
      await api.logout();
      setSession(null);
      navigate(loginPathForRole(r));
    },
    researchedSet,
    onResearched: markResearched,
  };

  // Admin-only routes
  if (path.startsWith("/admin-dashboard")) {
    if (session.role !== "admin") {
      navigate("/login/admin");
      return null;
    }
    return (
      <Shell {...shellProps}>
        <AdminDashboard />
      </Shell>
    );
  }

  // RM-or-Admin routes
  if (path.startsWith("/admin/vault")) {
    return (
      <Shell {...shellProps}>
        <AdminVault />
      </Shell>
    );
  }
  if (path.startsWith("/research/")) {
    if (session.role !== "rm") {
      navigate("/login/rm");
      return null;
    }
    const companyId = path.split("/")[2] || "VIV";
    return (
      <Shell {...shellProps}>
        <Research
          companyId={companyId}
          onSelectForInitiation={markResearched}
        />
      </Shell>
    );
  }
  if (path.startsWith("/rm-dashboard")) {
    if (session.role !== "rm") {
      navigate("/login/rm");
      return null;
    }
    return (
      <Shell {...shellProps}>
        <RMCockpit
          researchedSet={researchedSet}
          onResearched={markResearched}
        />
      </Shell>
    );
  }
  if (path.startsWith("/msme-portal")) {
    if (session.role !== "customer") {
      navigate("/login/customer");
      return null;
    }
    return (
      <Shell {...shellProps}>
        <MSMEPortal session={session} />
      </Shell>
    );
  }

  // Default: send to right home based on role
  if (session.role === "admin") {
    navigate("/admin-dashboard");
  } else if (session.role === "rm") {
    navigate("/rm-dashboard");
  } else {
    navigate("/msme-portal");
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared shell: header + footer for all logged-in views
// ---------------------------------------------------------------------------
function Shell({ session, onLogout, researchedSet, onResearched, children }) {
  const role = session.role;
  const onRM = role === "rm";
  const onAdmin = role === "admin";
  const homePath = onAdmin ? "/admin-dashboard" : onRM ? "/rm-dashboard" : "/msme-portal";
  return (
    <div className="min-h-screen flex flex-col bg-warm-50 text-warm-900">
      <header className="bg-white border-b border-warm-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(homePath)}
              className="flex items-center gap-3"
            >
              <Logo size={36} />
              <div className="leading-tight text-left">
                <div className="font-extrabold text-warm-900 tracking-tight text-[15px]">Future Bank of India</div>
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-warm-500">
                  Innovating the Indian Dream · AgentLoanNext
                  {onAdmin && <span className="ml-1.5 text-warm-900 font-bold">· Admin</span>}
                </div>
              </div>
            </button>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-warm-100 rounded-xl p-1">
            {onAdmin ? (
              <>
                <PortalTab label="Command Center" icon={LayoutDashboard} active={location.pathname === "/admin-dashboard"} onClick={() => navigate("/admin-dashboard")} />
                <PortalTab label="Vault" icon={Lock} active={location.pathname === "/admin/vault"} onClick={() => navigate("/admin/vault")} />
              </>
            ) : onRM ? (
              <PortalTab label="Cockpit" icon={LayoutDashboard} active onClick={() => navigate("/rm-dashboard")} />
            ) : (
              <PortalTab label="MSME Portal" icon={FileSignature} active onClick={() => navigate("/msme-portal")} />
            )}
          </nav>

          <div className="flex items-center gap-3 text-xs text-warm-500">
            {onRM && (
              <VoiceCopilot
                researchedSet={researchedSet}
                onResearched={onResearched}
              />
            )}
            {onRM && <Bell className="w-4 h-4 hidden lg:block" />}
            <span className="hidden lg:flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full animate-pulseDot ${onRM ? "bg-teal-500" : "bg-electric-500"}`} />
              {session.display_name}
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1 text-xs text-warm-500 hover:text-warm-900 px-2 py-1 rounded-md hover:bg-warm-100"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-warm-200 bg-white py-4 text-center text-[11px] text-warm-500">
        Future Bank of India · CoR <span className="font-mono">N-13.02458</span> · Built on
        Antigravity · India Stack 2026 · Hosted on Cloud Run (asia-south1)
      </footer>
    </div>
  );
}

function PortalTab({ label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
        active ? "bg-white text-electric-600 shadow ring-1 ring-warm-200" : "text-warm-600 hover:text-warm-900"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Booting() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50">
      <div className="flex items-center gap-3 text-warm-500 text-sm">
        <Logo size={32} />
        Booting AgentLoanNext...
      </div>
    </div>
  );
}
