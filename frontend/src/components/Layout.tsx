import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  Menu,
  X,
  Search,
  LayoutDashboard,
  ClipboardList,
  MessageSquare,
  Briefcase,
  Settings,
  UserRound,
  Layers,
  Shield,
  Star,
  Bell,
  LogOut,
} from "lucide-react";
import { useAuth } from "../app/auth";
import { Action } from "./ui";
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Lup">
      <img src="/favicon.svg" alt="" width="34" height="34" />
      <span>
        lup<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Layout() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  return (
    <>
      <a className="skip-link" href="#main">
        {t("view")}
      </a>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav">
            <NavLink to="/search">{t("search")}</NavLink>
            <NavLink to="/how-it-works">{t("how")}</NavLink>
            <NavLink to="/safety">{t("safety")}</NavLink>
          </nav>
          <div className="header-actions">
            <button
              className="language"
              aria-label={t("language")}
              onClick={() =>
                void i18n.changeLanguage(i18n.language === "es" ? "en" : "es")
              }
            >
              {i18n.language === "es" ? "EN" : "ES"}
            </button>
            {user ? (
              <Link className="button small" to="/app">
                {t("dashboard")}
                <ArrowUpRight size={16} />
              </Link>
            ) : (
              <>
                <Link className="desktop-nav" to="/login">
                  {t("login")}
                </Link>
                <Link className="button small" to="/register">
                  {t("register")}
                  <ArrowUpRight size={16} />
                </Link>
              </>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="mobile-links" onClick={() => setOpen(false)}>
            <Link to="/search">{t("search")}</Link>
            <Link to="/how-it-works">{t("how")}</Link>
            <Link to="/safety">{t("safety")}</Link>
            <Link to={user ? "/app" : "/login"}>
              {t(user ? "dashboard" : "login")}
            </Link>
            {user && (
              <button onClick={() => void signOut().then(() => nav("/"))}>
                {t("logout")}
              </button>
            )}
          </nav>
        )}
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer>
        <div className="container footer-top">
          <div>
            <Brand />
            <p>{t("footer")}</p>
          </div>
          <div className="footer-links">
            <Link to="/how-it-works">{t("how")}</Link>
            <Link to="/safety">{t("safety")}</Link>
            <Link to="/legal/terms">{t("terms")}</Link>
            <Link to="/legal/privacy">{t("privacy")}</Link>
            <Link to="/legal/community">{t("community")}</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Lup</span>
          <span>{t("free")}</span>
        </div>
      </footer>
    </>
  );
}
export function AppLayout() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const admin = user?.roles.some((r) =>
    ["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(r.role),
  );
  const links = [
    ["/app", "overview", LayoutDashboard],
    ["/app/requests", "myRequests", ClipboardList],
    ["/app/jobs", "jobs", Briefcase],
    ["/app/messages", "messages", MessageSquare],
    ["/app/reviews", "myReviews", Star],
    ["/app/professional", "profile", UserRound],
    ["/app/services", "myServices", Layers],
    ["/app/portfolio", "portfolio", Layers],
    ["/app/opportunities", "opportunities", Search],
    ["/app/proposals", "myProposals", ClipboardList],
    ["/app/notifications", "notifications", Bell],
    ["/app/settings", "settings", Settings],
  ] as const;
  return (
    <div className="container app-shell">
      <aside className="sidebar">
        <p className="eyebrow">{user?.name}</p>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/app"}>
              <Icon size={18} />
              {t(label)}
            </NavLink>
          ))}
          {admin && (
            <NavLink to="/app/admin">
              <Shield size={18} />
              {t("admin")}
            </NavLink>
          )}
        </nav>
        <button
          className="text-button"
          onClick={() => void signOut().then(() => nav("/"))}
        >
          <LogOut size={16} />
          {t("logout")}
        </button>
      </aside>
      <div className="workspace">
        {!user?.emailVerifiedAt && (
          <div className="alert verification-notice">
            <span>{t("verifyRequired")}</span>
            <Action path="/auth/resend-verification">{t("resend")}</Action>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
