import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Plus,
  ArrowUpRight,
  ClipboardList,
  MessageSquare,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../app/auth";
import { api, date, type Paginated } from "../services/api";
import { useCatalog } from "../services/catalog";
import {
  Action,
  Empty,
  ErrorBox,
  Loader,
  PageTitle,
  Pagination,
} from "../components/ui";
import { ImageUpload } from "./Requests";
import { SmartForm, type Field } from "../components/SmartForm";
export function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["summary"],
    queryFn: async () => {
      const [summary, notifications] = await Promise.all([
        api("/users/summary"),
        api("/notifications?limit=5"),
      ]);
      return { ...summary, notifications };
    },
  });
  return (
    <>
      <PageTitle
        title={t("welcome")}
        description={user?.name}
        action={
          <Link className="button" to="/app/requests/new">
            <Plus size={18} />
            {t("publish")}
          </Link>
        }
      />
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loader />
      ) : (
        q.data && (
          <>
            <div className="metrics summary-metrics">
              <Link className="metric" to="/app/requests">
                <ClipboardList />
                <strong>{q.data.openRequests}</strong>
                <span>{t("openRequests")}</span>
              </Link>
              <Link className="metric" to="/app/proposals">
                <ClipboardList />
                <strong>{q.data.pendingProposals}</strong>
                <span>{t("pendingProposals")}</span>
              </Link>
              <Link className="metric" to="/app/jobs">
                <Briefcase />
                <strong>{q.data.activeJobs}</strong>
                <span>{t("activeJobs")}</span>
              </Link>
              <Link className="metric" to="/app/messages">
                <MessageSquare />
                <strong>{q.data.unread}</strong>
                <span>{t("unread")}</span>
              </Link>
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="section-heading">
                  <h2>{t("notifications")}</h2>
                  <Link to="/app/notifications" aria-label={t("viewAll")}>
                    <ArrowUpRight size={20} />
                  </Link>
                </div>
                {q.data.notifications.items.length ? (
                  q.data.notifications.items.map((n: any) => (
                    <NotificationRow key={n.id} n={n} />
                  ))
                ) : (
                  <Empty text={t("noNotifications")} />
                )}
              </section>
              <section className="panel next-step">
                <span className="eyebrow">LUP / PRO</span>
                <h2>{t("proCta")}</h2>
                <p>{t("proText")}</p>
                <Link className="button secondary" to="/app/professional">
                  {t(user?.professional ? "profile" : "createProfile")}
                  <ArrowRight size={17} />
                </Link>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
function NotificationRow({ n }: { n: any }) {
  const { t, i18n } = useTranslation();
  let path = "/app";
  if (n.kind === "NEW_MESSAGE") path = `/app/messages/${n.resourceId}`;
  else if (["NEW_PROPOSAL", "PROPOSAL_REJECTED"].includes(n.kind))
    path = `/app/requests/${n.resourceId}`;
  else if (
    [
      "NEW_ENGAGEMENT",
      "PROPOSAL_ACCEPTED",
      "ENGAGEMENT_STATE",
      "NEW_REVIEW",
    ].includes(n.kind)
  )
    path = `/app/jobs/${n.resourceId}`;
  return (
    <div className="notification-row">
      <Link to={path}>
        <span className={!n.readAt ? "notification-dot" : ""} />
        <div>
          <strong>{t(n.kind)}</strong>
          <small>{date(n.createdAt, i18n.language)}</small>
        </div>
      </Link>
      {!n.readAt && (
        <Action path={`/notifications/${n.id}/read`} className="text-button">
          {t("markRead")}
        </Action>
      )}
    </div>
  );
}
export function Notifications() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["notifications", page],
    queryFn: () => api<Paginated>(`/notifications?page=${page}`),
    refetchInterval: 30000,
  });
  return (
    <>
      <PageTitle title={t("notifications")} />
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loader />
      ) : (
        q.data && (
          <section className="panel">
            {q.data.items.length ? (
              q.data.items.map((n) => <NotificationRow key={n.id} n={n} />)
            ) : (
              <Empty text={t("noNotifications")} />
            )}
            <Pagination data={q.data} onChange={setPage} />
          </section>
        )
      )}
    </>
  );
}
export function Settings() {
  const { t, i18n } = useTranslation();
  const { user, refresh } = useAuth();
  const catalog = useCatalog();
  const cache = useQueryClient();
  const nav = useNavigate();
  const [deactivate, setDeactivate] = useState(false);
  const [confirm, setConfirm] = useState("");
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<any[]>("/users/me/sessions"),
  });
  const [sessionError, setSessionError] = useState<unknown>(null);
  const blocks = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api<any[]>("/blocks"),
  });
  const removal = useMutation({
    mutationFn: () => api("/users/me/deactivate", "POST"),
    onSuccess: async () => {
      await refresh();
      cache.clear();
      nav("/");
    },
  });
  const fields: Field[] = [
    { name: "name", label: "name", min: 2, max: 100 },
    { name: "phone", label: "phone", optional: true },
    {
      name: "countryCode",
      label: "country",
      options: catalog.countries.map((c) => ({ value: c.code, label: c.name })),
    },
    {
      name: "cityId",
      label: "city",
      options: catalog.cities.map((c) => ({
        value: c.id,
        label: `${c.name} (${c.countryCode})`,
      })),
    },
    {
      name: "locale",
      label: "language",
      options: [
        { value: "es", label: "Español" },
        { value: "en", label: "English" },
      ],
    },
    {
      name: "timezone",
      label: "timezone",
      options: Intl.supportedValuesOf("timeZone")
        .concat("UTC")
        .map((z) => ({ value: z, label: z })),
    },
  ];
  return (
    <>
      <PageTitle title={t("settings")} />
      <div className="stack">
        <section className="panel">
          <h2>{t("account")}</h2>
          <p>{user?.email}</p>
          {catalog.loading ? (
            <Loader />
          ) : (
            <SmartForm
              key={user?.id}
              initial={user ?? {}}
              fields={fields}
              submit="save"
              success="saved"
              onSubmit={async (d) => {
                await api("/users/me", "PATCH", d);
                await i18n.changeLanguage(d.locale);
                await refresh();
              }}
            />
          )}
        </section>
        <section className="panel">
          <h2>{t("profile")}</h2>
          <ImageUpload endpoint="/users/me/avatar" />
        </section>
        <section className="panel">
          <h2>{t("reset")}</h2>
          <SmartForm
            fields={[
              {
                name: "currentPassword",
                label: "currentPassword",
                type: "password",
              },
              { name: "password", label: "password", type: "password" },
            ]}
            submit="reset"
            onSubmit={async (d) => {
              await api("/auth/change-password", "POST", d);
              await refresh();
              nav("/login");
            }}
          />
        </section>
        <section className="panel">
          <h2>{t("sessions")}</h2>
          <ErrorBox error={sessions.error || sessionError} />
          {sessions.data?.map((s) => (
            <div className="list-row" key={s.id}>
              <span>
                {date(s.createdAt, i18n.language)} →{" "}
                {date(s.expiresAt, i18n.language)}
              </span>
              <button
                className="button secondary"
                onClick={() =>
                  void api(`/users/me/sessions/${s.id}`, "DELETE")
                    .then(async () => {
                      await refresh();
                      await cache.invalidateQueries();
                    })
                    .catch(setSessionError)
                }
              >
                {t("revokeSession")}
              </button>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>{t("blockedUsers")}</h2>
          {blocks.data?.map((b) => (
            <div key={b.blockedId} className="list-row">
              <span>{b.blocked.name}</span>
              <button
                className="button secondary"
                onClick={() =>
                  void api(`/blocks/${b.blockedId}`, "DELETE").then(() =>
                    cache.invalidateQueries({ queryKey: ["blocks"] }),
                  )
                }
              >
                {t("unblock")}
              </button>
            </div>
          ))}
          <ErrorBox error={blocks.error} />
        </section>
        <section className="panel">
          <h2>{t("deactivate")}</h2>
          <p>{t("deactivateHelp")}</p>
          <button
            className="button danger"
            onClick={() => setDeactivate(!deactivate)}
          >
            {t("deactivate")}
          </button>
          {deactivate && (
            <div className="stack">
              <label>
                {t("deactivateConfirm")}
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <button
                className="button danger"
                disabled={
                  !["DESACTIVAR", "DEACTIVATE"].includes(confirm) ||
                  removal.isPending
                }
                onClick={() => removal.mutate()}
              >
                {t("deactivate")}
              </button>
              <ErrorBox error={removal.error} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
export function MyReviews() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["myReviews", page],
    queryFn: () => api<Paginated>(`/reviews/mine?page=${page}`),
  });
  return (
    <>
      <PageTitle title={t("myReviews")} />
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loader />
      ) : (
        q.data && (
          <section className="panel">
            {q.data.items.length ? (
              q.data.items.map((r) => (
                <article key={r.id} className="review">
                  <Link to={`/app/jobs/${r.engagementId}`}>
                    <strong>{r.engagement.title}</strong>
                  </Link>
                  <p>★ {r.rating} / 5</p>
                  <p>{r.comment}</p>
                  <small>{date(r.createdAt, i18n.language)}</small>
                </article>
              ))
            ) : (
              <Empty text={t("reviewHelp")} />
            )}
            <Pagination data={q.data} onChange={setPage} />
          </section>
        )
      )}
    </>
  );
}
