import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../app/auth";
import { api } from "../services/api";
import { useCatalog } from "../services/catalog";
import { SmartForm, type Field } from "../components/SmartForm";
import { ErrorBox, Loader, PageTitle } from "../components/ui";
export function AuthPage({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset" | "verify";
}) {
  const { t } = useTranslation();
  const auth = useAuth();
  const catalog = useCatalog();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const target = params.get("next");
  const next =
    target?.startsWith("/") && !target.startsWith("//") ? target : "/app";
  if (auth.loading) return <Loader />;
  let fields: Field[] = [];
  if (["login", "register", "forgot"].includes(mode))
    fields.push({ name: "email", label: "email", type: "email", max: 254 });
  if (["login", "register", "reset"].includes(mode))
    fields.push({ name: "password", label: "password", type: "password" });
  if (mode === "register")
    fields = [
      { name: "name", label: "name", min: 2, max: 100 },
      ...fields,
      {
        name: "countryCode",
        label: "country",
        options: catalog.countries.map((c) => ({
          value: c.code,
          label: c.name,
        })),
      },
      {
        name: "accountType",
        label: "accountType",
        options: [
          { value: "CLIENT", label: t("client") },
          { value: "PROFESSIONAL", label: t("professional") },
        ],
      },
    ];
  const title = {
    login: "login",
    register: "register",
    forgot: "forgotTitle",
    reset: "reset",
    verify: "verify",
  }[mode];
  const submit = {
    login: "login",
    register: "register",
    forgot: "sendRecovery",
    reset: "reset",
    verify: "verify",
  }[mode];
  const success = {
    login: undefined,
    register: "registerDone",
    forgot: "recoveryDone",
    reset: "resetDone",
    verify: "verifyDone",
  }[mode];
  return (
    <div className="auth-section container">
      <div className="auth-story">
        <span className="eyebrow">LUP / {t("free")}</span>
        <h2>
          {t("heroA")}
          <br />
          {t("heroB")}
        </h2>
        <p>{t("oneAccount")}</p>
        <div className="auth-decoration" aria-hidden="true">
          ✳
        </div>
      </div>
      <section className="auth-card">
        <PageTitle title={t(title)} />
        <ErrorBox error={catalog.error} />
        <SmartForm
          key={mode}
          fields={fields}
          initial={{ token: params.get("token") ?? "", accountType: "CLIENT" }}
          submit={submit}
          success={success}
          onSubmit={async (d) => {
            if (mode === "login") {
              await auth.signIn(d.email, d.password);
              nav(next);
              return;
            }
            if (mode === "register")
              return api("/auth/register", "POST", {
                ...d,
                locale: localStorage.getItem("lup_language") ?? "es",
              });
            if (mode === "forgot")
              return api("/auth/forgot-password", "POST", d);
            if (mode === "reset")
              return api("/auth/reset-password", "POST", {
                ...d,
                token: params.get("token") ?? "",
              });
            const r = await api("/auth/verify-email", "POST", {
              token: params.get("token") ?? "",
            });
            await auth.refresh();
            return r;
          }}
        />
        {mode === "login" && (
          <div className="auth-links">
            <Link to="/forgot-password">{t("forgot")}</Link>
            <Link to="/register">{t("register")}</Link>
          </div>
        )}
        {mode !== "login" && (
          <Link className="text-link auth-link" to="/login">
            {t("login")} →
          </Link>
        )}
        {import.meta.env.DEV &&
          ["register", "forgot", "verify"].includes(mode) && (
            <p className="muted">{t("localMail")}</p>
          )}
      </section>
    </div>
  );
}
