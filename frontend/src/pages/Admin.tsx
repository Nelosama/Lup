import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useAuth } from "../app/auth";
import { api, date, type Paginated } from "../services/api";
import { categoryName, useCatalog } from "../services/catalog";
import { SmartForm } from "../components/SmartForm";
import {
  Modal,
  Empty,
  ErrorBox,
  Loader,
  PageTitle,
  Pagination,
  Status,
} from "../components/ui";
const metricKeys = [
  "users",
  "activeProfessionals",
  "activeClients",
  "requests",
  "requestsWithProposals",
  "proposals",
  "acceptedProposals",
  "reportedEngagements",
  "mutuallyReportedCompletedJobs",
  "reviews",
  "recurringClients",
  "recurringProfessionals",
  "averageSecondsToFirstProposal",
];
export function Admin() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const roles = user?.roles.map((r) => r.role) ?? [];
  const moderatorOnly = !roles.some((r) =>
    ["ADMIN", "SUPER_ADMIN"].includes(r),
  );
  const superAdmin = roles.includes("SUPER_ADMIN");
  const tabs = moderatorOnly
    ? ["moderation"]
    : [
        "analytics",
        "users",
        "professionals",
        "clients",
        "categories",
        "countries",
        "requests",
        "proposals",
        "engagements",
        "moderation",
        ...(superAdmin ? ["audit"] : []),
      ];
  const tab = tabs.includes(params.get("tab") ?? "")
    ? params.get("tab")!
    : tabs[0];
  const page = Number(params.get("page") ?? 1);
  const cache = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [evidence, setEvidence] = useState<any>(null);
  const [error, setError] = useState<unknown>(null);
  const catalog = useCatalog();
  const endpoint =
    tab === "moderation" ? "/moderation/reports" : `/admin/${tab}`;
  const q = useQuery({
    queryKey: ["admin", tab, page],
    queryFn: () => api(`${endpoint}?page=${page}`),
  });
  const paged = q.data && "items" in q.data;
  const items = q.data
    ? paged
      ? q.data.items
      : Array.isArray(q.data)
        ? q.data
        : []
    : [];
  const done = async () => {
    setSelected(null);
    setEvidence(null);
    await cache.invalidateQueries();
  };
  const mutate = async (path: string, body: unknown, method = "POST") => {
    const r = await api(path, method, body);
    await done();
    return r;
  };
  return (
    <>
      <PageTitle title={t("admin")} />
      <nav className="tabs" aria-label={t("admin")}>
        {tabs.map((k) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => {
              setParams({ tab: k });
              setSelected(null);
              setEvidence(null);
              setError(null);
            }}
          >
            {t(k === "engagements" ? "jobs" : k)}
          </button>
        ))}
      </nav>
      <ErrorBox error={q.error || error} />
      {q.isPending ? (
        <Loader />
      ) : tab === "analytics" && q.data ? (
        <>
          <div className="metrics admin-metrics">
            {metricKeys.map((k) => (
              <div className="metric" key={k}>
                <span>{t(`metric_${k}`)}</span>
                <strong>
                  {q.data[k] === null
                    ? "—"
                    : new Intl.NumberFormat(i18n.language, {
                        maximumFractionDigits: 1,
                      }).format(q.data[k])}
                </strong>
              </div>
            ))}
          </div>
          <p className="alert">{t("noIndependentVerification")}</p>
          <div className="dashboard-grid">
            {["byCity", "byCategory"].map((k) => (
              <section className="panel" key={k}>
                <h2>{t(k)}</h2>
                {q.data[k].map((r: any) => {
                  const name =
                    k === "byCity"
                      ? catalog.cities.find((c) => c.id === r.cityId)?.name
                      : catalog.categories.find((c) => c.id === r.categoryId);
                  return (
                    <div className="list-row" key={r.cityId ?? r.categoryId}>
                      <span>
                        {typeof name === "string"
                          ? name
                          : name
                            ? categoryName(name)
                            : (r.cityId ?? r.categoryId)}
                      </span>
                      <strong>{r._count}</strong>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          {tab === "categories" && (
            <button
              className="button section-small"
              onClick={() =>
                setSelected({
                  create: true,
                  active: true,
                  requiresLicense: false,
                  position: items.length,
                })
              }
            >
              <Plus size={16} />
              {t("categories")}
            </button>
          )}
          {items.length ? (
            <div className="stack">
              {items.map((item: any) => (
                <article className="panel" key={item.id ?? item.code}>
                  <div className="section-heading">
                    <h3>
                      {item.name ??
                        item.title ??
                        item.slug ??
                        item.action ??
                        item.targetType ??
                        item.code ??
                        item.id}
                    </h3>
                    {item.status && <Status value={item.status} />}
                  </div>
                  {["users", "professionals", "clients"].includes(tab) && (
                    <>
                      <p>{item.email}</p>
                      <p className="muted">
                        {item.roles.map((r: any) => r.role).join(" · ")}
                      </p>
                      {superAdmin && (
                        <div className="actions">
                          <button
                            className="button secondary"
                            onClick={() =>
                              setSelected({ ...item, mode: "status" })
                            }
                          >
                            {t(
                              item.status === "ACTIVE" ? "suspend" : "activate",
                            )}
                          </button>
                          {item.professional && (
                            <button
                              className="button secondary"
                              onClick={() =>
                                setSelected({ ...item, mode: "verification" })
                              }
                            >
                              {t("verification")}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {tab === "categories" && (
                    <>
                      <p>
                        {item.translations
                          .map((v: any) => `${v.locale}: ${v.name}`)
                          .join(" · ")}
                      </p>
                      <span className="badge">
                        {t(item.active ? "active" : "unavailable")}
                      </span>
                      <button
                        className="button secondary"
                        onClick={() => setSelected(item)}
                      >
                        {t("save")}
                      </button>
                    </>
                  )}
                  {tab === "countries" && (
                    <div className="actions">
                      <span className="badge">
                        {t(item.enabled ? "active" : "unavailable")}
                      </span>
                      {superAdmin && (
                        <button
                          className="button secondary"
                          onClick={() =>
                            void mutate(
                              `/admin/countries/${item.code}`,
                              { enabled: !item.enabled },
                              "PATCH",
                            ).catch(setError)
                          }
                        >
                          {t(item.enabled ? "cancel" : "activate")}
                        </button>
                      )}
                    </div>
                  )}
                  {tab === "moderation" && (
                    <>
                      <p>{item.reason}</p>
                      <p className="muted">
                        {item.targetType} · {item.targetId}
                      </p>
                      {item.status === "OPEN" && (
                        <button
                          className="button secondary"
                          onClick={() => {
                            setSelected(item);
                            setEvidence(null);
                          }}
                        >
                          {t("moderation")}
                        </button>
                      )}
                    </>
                  )}
                  {tab === "audit" && (
                    <>
                      <p>{item.reason}</p>
                      <small>
                        {item.actorId} → {item.targetId}
                      </small>
                    </>
                  )}
                  {["requests", "proposals", "engagements"].includes(tab) && (
                    <p className="muted">{item.id}</p>
                  )}
                  {item.createdAt && (
                    <small className="muted">
                      {date(item.createdAt, i18n.language)}
                    </small>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty text={t("noData")} />
          )}
          {paged && (
            <Pagination
              data={q.data as Paginated}
              onChange={(p) => setParams({ tab, page: String(p) })}
            />
          )}
        </>
      )}
      {selected && (
        <Modal label={t(tab)} onClose={() => setSelected(null)}>
          <div className="section-heading">
            <h2>{t(tab)}</h2>
            <button
              className="icon-button"
              onClick={() => setSelected(null)}
              aria-label={t("cancel")}
            >
              ×
            </button>
          </div>
          {["users", "professionals", "clients"].includes(tab) &&
            selected.mode === "status" && (
              <SmartForm
                fields={[
                  {
                    name: "reason",
                    label: "reason",
                    type: "textarea",
                    min: 15,
                    max: 2000,
                  },
                ]}
                submit={selected.status === "ACTIVE" ? "suspend" : "activate"}
                onSubmit={(d) =>
                  mutate(`/admin/users/${selected.id}/status`, {
                    ...d,
                    status:
                      selected.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                  })
                }
              />
            )}
          {["users", "professionals", "clients"].includes(tab) &&
            selected.mode === "verification" && (
              <SmartForm
                fields={[
                  {
                    name: "status",
                    label: "status",
                    options: [
                      "UNVERIFIED",
                      "PENDING_REVIEW",
                      "VERIFIED",
                      "REJECTED",
                    ].map((s) => ({ value: s, label: t(s) })),
                  },
                  {
                    name: "evidence",
                    label: "verificationEvidence",
                    type: "textarea",
                    min: 30,
                    max: 2000,
                  },
                ]}
                submit="save"
                onSubmit={(d) =>
                  mutate(
                    `/admin/professionals/${selected.professional.id}/verification`,
                    d,
                  )
                }
              />
            )}
          {tab === "categories" && (
            <SmartForm
              key={selected.id ?? "new"}
              initial={{
                ...selected,
                es: selected.translations?.find((v: any) => v.locale === "es")
                  ?.name,
                en: selected.translations?.find((v: any) => v.locale === "en")
                  ?.name,
                position: String(selected.position),
              }}
              fields={[
                { name: "slug", label: "categorySlug", max: 80 },
                { name: "es", label: "spanish", min: 2, max: 100 },
                { name: "en", label: "english", min: 2, max: 100 },
                { name: "position", label: "status", type: "number" },
                { name: "active", label: "active", type: "checkbox" },
                {
                  name: "requiresLicense",
                  label: "regulated",
                  type: "checkbox",
                },
              ]}
              submit="save"
              onSubmit={(d) => {
                const { es, en, position, ...rest } = d;
                return mutate(
                  selected.create
                    ? "/admin/categories"
                    : `/admin/categories/${selected.id}`,
                  {
                    ...rest,
                    position: Number(position),
                    translations: [
                      { locale: "es", name: es },
                      { locale: "en", name: en },
                    ],
                  },
                  selected.create ? "POST" : "PATCH",
                );
              }}
            />
          )}
          {tab === "moderation" && (
            <>
              <p>{selected.reason}</p>
              {selected.targetType === "MESSAGE" && (
                <>
                  <SmartForm
                    fields={[
                      {
                        name: "reason",
                        label: "reason",
                        type: "textarea",
                        min: 20,
                        max: 2000,
                      },
                    ]}
                    submit="reviewEvidence"
                    onSubmit={async (d) =>
                      setEvidence(
                        await api(
                          `/moderation/reports/${selected.id}/evidence`,
                          "POST",
                          d,
                        ),
                      )
                    }
                  />
                  {evidence && <blockquote>{evidence.body}</blockquote>}
                </>
              )}
              <SmartForm
                fields={[
                  {
                    name: "action",
                    label: "moderation",
                    options: [
                      { value: "DISMISS", label: t("dismiss") },
                      { value: "RESOLVE", label: t("resolve") },
                      ...(["REQUEST", "REVIEW", "MESSAGE"].includes(
                        selected.targetType,
                      )
                        ? [{ value: "HIDE_CONTENT", label: t("hideContent") }]
                        : []),
                      ...(["USER", "PROFILE"].includes(selected.targetType)
                        ? [{ value: "SUSPEND_USER", label: t("suspend") }]
                        : []),
                    ],
                  },
                  {
                    name: "reason",
                    label: "reason",
                    type: "textarea",
                    min: 15,
                    max: 2000,
                  },
                ]}
                submit="resolve"
                onSubmit={(d) =>
                  mutate(`/moderation/reports/${selected.id}/resolve`, d)
                }
              />
            </>
          )}
        </Modal>
      )}
    </>
  );
}
