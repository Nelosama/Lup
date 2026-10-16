import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  api,
  ApiError,
  setCsrf,
  setTimeZone,
  type User,
} from "../services/api";
import { ErrorBox, Loader } from "../components/ui";
type Auth = {
  user: User | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<Auth>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const generation = useRef(0);
  const cache = useQueryClient();
  const refresh = async () => {
    const current = ++generation.current;
    try {
      const r = await api("/auth/me");
      if (current !== generation.current) return;
      setCsrf(r.csrfToken);
      setTimeZone(r.user.timezone);
      setUser(r.user);
      setError(null);
    } catch (e) {
      if (current !== generation.current) return;
      if (e instanceof ApiError && e.status === 401) {
        setCsrf("");
        setUser(null);
        setError(null);
      } else setError(e);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const signIn = async (email: string, password: string) => {
    const current = ++generation.current;
    const r = await api("/auth/login", "POST", { email, password });
    if (current !== generation.current) return;
    cache.clear();
    setCsrf(r.csrfToken);
    setTimeZone(r.user.timezone);
    setUser(r.user);
    setError(null);
    setLoading(false);
  };
  const signOut = async () => {
    ++generation.current;
    await api("/auth/logout", "POST");
    cache.clear();
    setCsrf("");
    setUser(null);
    setError(null);
  };
  return (
    <Context.Provider
      value={{ user, loading, error, refresh, signIn, signOut }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
export function Protected({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: string[];
}) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  if (loading) return <Loader />;
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
        <button className="button" onClick={() => void refresh()}>
          {t("retry")}
        </button>
      </div>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (roles && !user.roles.some((r) => roles.includes(r.role)))
    return <Navigate to="/app" replace />;
  return children;
}
