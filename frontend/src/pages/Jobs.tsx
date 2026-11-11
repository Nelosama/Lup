import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { useAuth } from "../app/auth";
import { api, date, money, type Paginated } from "../services/api";
import {
  Action,
  Empty,
  ErrorBox,
  Loader,
  PageTitle,
  Pagination,
  ReportButton,
  Status,
} from "../components/ui";
import { SmartForm } from "../components/SmartForm";
export function JobList() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["jobs", page],
    queryFn: () => api<Paginated>(`/engagements?page=${page}`),
  });
  return (
    <>
      <PageTitle title={t("jobs")} />
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loader />
      ) : (
        q.data && (
          <>
            {q.data.items.length ? (
              <div className="stack">
                {q.data.items.map((e) => (
                  <Link className="panel" to={`/app/jobs/${e.id}`} key={e.id}>
                    <div className="section-heading">
                      <h2>{e.title}</h2>
                      <Status value={e.status} />
                    </div>
                    <p>
                      {user?.id === e.clientId
                        ? e.professional.name
                        : e.client.name}
                    </p>
                    <small>{date(e.createdAt, i18n.language)}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty to="/search" action={t("search")} />
            )}
            <Pagination data={q.data} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
export function JobDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["job", id],
    queryFn: () => api(`/engagements/${id}`),
  });
  if (q.isPending) return <Loader />;
  if (q.error) return <ErrorBox error={q.error} />;
  const e = q.data;
  const completed =
    user?.id === e.clientId ? e.clientCompletedAt : e.professionalCompletedAt;
  const reviewed = e.reviews.some((r: any) => r.reviewerId === user?.id);
  return (
    <>
      <PageTitle title={e.title} action={<Status value={e.status} />} />
      <div className="stack">
        <section className="panel">
          <div className="job-people">
            <div>
              <span className="eyebrow">{t("client")}</span>
              <h3>{e.client.name}</h3>
            </div>
            <span>↔</span>
            <div>
              <span className="eyebrow">{t("professional")}</span>
              <h3>{e.professional.name}</h3>
            </div>
          </div>
          {e.agreedPrice && (
            <p>
              {t("agreed")}:{" "}
              <strong>
                {money(e.agreedPrice, e.currencyCode, i18n.language)}
              </strong>
            </p>
          )}
          <p>{t("completionHelp")}</p>
          <div className="actions">
            {e.conversation && (
              <Link
                className="button"
                to={`/app/messages/${e.conversation.id}`}
              >
                <MessageSquare size={16} />
                {t("messages")}
              </Link>
            )}
            {e.status === "AGREED" &&
              !e.professionalAgreedAt &&
              user?.id === e.professionalId && (
                <Action
                  path={`/engagements/${id}/state`}
                  body={{ action: "AGREE" }}
                >
                  {t("agreeJob")}
                </Action>
              )}
            {e.status === "AGREED" && e.professionalAgreedAt && (
              <Action
                path={`/engagements/${id}/state`}
                body={{ action: "START" }}
              >
                {t("startJob")}
              </Action>
            )}
            {e.status === "IN_PROGRESS" && !completed && (
              <Action
                path={`/engagements/${id}/state`}
                body={{ action: "COMPLETE" }}
              >
                {t("confirmCompletion")}
              </Action>
            )}
            {completed && <span className="badge">{t("yourCompletion")}</span>}
            {["AGREED", "IN_PROGRESS"].includes(e.status) && (
              <Action
                path={`/engagements/${id}/state`}
                body={{ action: "CANCEL" }}
              >
                {t("cancelJob")}
              </Action>
            )}
            {["IN_PROGRESS", "COMPLETED"].includes(e.status) && (
              <Action
                path={`/engagements/${id}/state`}
                body={{ action: "DISPUTE" }}
              >
                {t("dispute")}
              </Action>
            )}
            <ReportButton targetType="ENGAGEMENT" targetId={e.id} />
          </div>
        </section>
        {e.status === "COMPLETED" && !reviewed && (
          <section className="panel form-panel">
            <h2>{t("leaveReview")}</h2>
            <p>{t("reviewHelp")}</p>
            <SmartForm
              fields={[
                {
                  name: "rating",
                  label: "rating",
                  options: [1, 2, 3, 4, 5].map((v) => ({
                    value: String(v),
                    label: `${v} / 5`,
                  })),
                },
                {
                  name: "comment",
                  label: "comment",
                  type: "textarea",
                  optional: true,
                  max: 2000,
                },
              ]}
              submit="leaveReview"
              onSubmit={async (d) => {
                await api("/reviews", "POST", {
                  ...d,
                  comment: d.comment ?? "",
                  rating: Number(d.rating),
                  engagementId: e.id,
                });
                await cache.invalidateQueries();
              }}
            />
          </section>
        )}
        {e.reviews.map((r: any) => (
          <section className="panel" key={r.id}>
            <h3>
              {t("review")} · ★ {r.rating}/5
            </h3>
            <p>{r.comment}</p>
            <ReportButton targetType="REVIEW" targetId={r.id} />
          </section>
        ))}
      </div>
    </>
  );
}
