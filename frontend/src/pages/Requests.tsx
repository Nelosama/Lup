import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MapPin, Plus, ArrowUpRight } from "lucide-react";
import { useAuth } from "../app/auth";
import {
  api,
  date,
  calendarDate,
  money,
  type Paginated,
} from "../services/api";
import { categoryName, useCatalog } from "../services/catalog";
import { SmartForm, type Field } from "../components/SmartForm";
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
import { PortfolioPhoto } from "./Public";
export function RequestList({
  opportunities = false,
}: {
  opportunities?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const catalog = useCatalog();
  const q = useQuery({
    queryKey: ["requests", opportunities, params.toString()],
    queryFn: () =>
      api<Paginated>(`/requests${opportunities ? "" : "/mine"}?${params}`),
  });
  return (
    <>
      <PageTitle
        title={t(opportunities ? "opportunities" : "myRequests")}
        action={
          !opportunities && (
            <Link className="button" to="/app/requests/new">
              <Plus size={17} />
              {t("publish")}
            </Link>
          )
        }
      />
      {opportunities && (
        <div className="filter-row">
          <label>
            {t("category")}
            <select
              value={params.get("categoryId") ?? ""}
              onChange={(e) => setParams({ categoryId: e.target.value })}
            >
              <option value="">{t("anyCategory")}</option>
              {catalog.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryName(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("city")}
            <select
              value={params.get("cityId") ?? ""}
              onChange={(e) =>
                setParams({
                  ...Object.fromEntries(params),
                  cityId: e.target.value,
                  page: "1",
                })
              }
            >
              <option value="">{t("anyCity")}</option>
              {catalog.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loader />
      ) : (
        q.data && (
          <>
            {q.data.items.length ? (
              <div className="stack">
                {q.data.items.map((r) => (
                  <Link
                    key={r.id}
                    className="panel request-card"
                    to={`/app/requests/${r.id}`}
                  >
                    <div>
                      <span className="eyebrow">
                        {categoryName(r.category)}
                      </span>
                      <h2>{r.title}</h2>
                      <p className="clamp-2">{r.description}</p>
                      <div className="inline-meta">
                        <span>
                          <MapPin size={14} />
                          {r.city.name}
                        </span>
                        <span>{date(r.createdAt, i18n.language)}</span>
                        <span>
                          {r._count.proposals} {t("proposals").toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <div className="request-card-side">
                      <Status value={r.status} />
                      {r.budgetMax && (
                        <strong>
                          {money(r.budgetMax, r.currencyCode, i18n.language)}
                        </strong>
                      )}
                      <ArrowUpRight size={20} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                text={t("emptySearch")}
                to={opportunities ? "/app/professional" : "/app/requests/new"}
                action={t(opportunities ? "createProfile" : "publish")}
              />
            )}
            <Pagination
              data={q.data}
              onChange={(p) =>
                setParams({ ...Object.fromEntries(params), page: String(p) })
              }
            />
          </>
        )
      )}
    </>
  );
}
export function RequestForm() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const catalog = useCatalog();
  const q = useQuery({
    queryKey: ["request", id],
    queryFn: () => api(`/requests/${id}`),
    enabled: !!id,
  });
  if (catalog.loading || (id && q.isPending)) return <Loader />;
  if (q.error) return <ErrorBox error={q.error} />;
  const initial = q.data ?? {
    countryCode: user?.countryCode,
    cityId: user?.cityId,
    currencyCode: catalog.countries.find((c) => c.code === user?.countryCode)
      ?.currencyCode,
  };
  const fields: Field[] = [
    { name: "title", label: "title", min: 5, max: 120 },
    {
      name: "categoryId",
      label: "category",
      options: catalog.categories.map((c) => ({
        value: c.id,
        label: categoryName(c),
      })),
    },
    {
      name: "description",
      label: "description",
      type: "textarea",
      min: 20,
      max: 4000,
    },
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
    { name: "approximateLocation", label: "approximate", min: 2, max: 120 },
    { name: "budgetMin", label: "budgetMin", type: "number", optional: true },
    { name: "budgetMax", label: "budgetMax", type: "number", optional: true },
    {
      name: "currencyCode",
      label: "currency",
      options: Intl.supportedValuesOf("currency").map((c) => ({
        value: c,
        label: c,
      })),
    },
    {
      name: "preferredDate",
      label: "preferredDate",
      type: "date",
      optional: true,
    },
  ];
  return (
    <>
      <PageTitle
        title={t(id ? "editRequest" : "newRequest")}
        description={t("requestHelp")}
      />
      <section className="panel form-panel">
        <SmartForm
          fields={fields}
          initial={{
            ...initial,
            preferredDate: initial.preferredDate?.slice(0, 10),
          }}
          submit={id ? "save" : "createRequest"}
          onSubmit={async (d) => {
            const r = await api(
              id ? `/requests/${id}` : "/requests",
              id ? "PATCH" : "POST",
              d,
            );
            nav(`/app/requests/${r.id}`);
          }}
        />
      </section>
    </>
  );
}
export function RequestDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const cache = useQueryClient();
  const [proposal, setProposal] = useState(false);
  const q = useQuery({
    queryKey: ["request", id],
    queryFn: () => api(`/requests/${id}`),
  });
  if (q.isPending) return <Loader />;
  if (q.error) return <ErrorBox error={q.error} />;
  const r = q.data;
  const owner = r.clientId === user?.id;
  return (
    <>
      <PageTitle
        title={r.title}
        description={`${categoryName(r.category)} · ${r.city.name}`}
        action={<Status value={r.status} />}
      />
      <div className="stack">
        <section className="panel">
          <p className="preserve">{r.description}</p>
          <p>
            <MapPin size={15} /> {r.approximateLocation} · {r.city.name}
          </p>
          {r.budgetMax && (
            <p>
              {money(r.budgetMin ?? 0, r.currencyCode, i18n.language)} –{" "}
              {money(r.budgetMax, r.currencyCode, i18n.language)}
            </p>
          )}
          {r.preferredDate && (
            <p>
              {t("preferredDate")}:{" "}
              {calendarDate(r.preferredDate, i18n.language)}
            </p>
          )}
          <div className="actions">
            {owner && r.status === "OPEN" && (
              <>
                <Action path={`/requests/${id}/cancel`}>
                  {t("cancelRequest")}
                </Action>
                {r._count.proposals === 0 && (
                  <Link
                    className="button secondary"
                    to={`/app/requests/${id}/edit`}
                  >
                    {t("editRequest")}
                  </Link>
                )}
              </>
            )}
            {!owner && r.status === "OPEN" && (
              <button className="button" onClick={() => setProposal(!proposal)}>
                {t("sendProposal")}
              </button>
            )}
            {r.engagement && (
              <Link className="button" to={`/app/jobs/${r.engagement.id}`}>
                {t("jobs")}
                <ArrowUpRight size={18} />
              </Link>
            )}
            <ReportButton targetType="REQUEST" targetId={r.id} />
          </div>
        </section>
        {proposal && (
          <section className="panel">
            <h2>{t("sendProposal")}</h2>
            <SmartForm
              fields={[
                {
                  name: "description",
                  label: "description",
                  type: "textarea",
                  min: 20,
                  max: 3000,
                },
                {
                  name: "estimatedPrice",
                  label: "estimatedPrice",
                  type: "number",
                },
                {
                  name: "estimatedDuration",
                  label: "duration",
                  min: 2,
                  max: 120,
                },
              ]}
              submit="sendProposal"
              onSubmit={async (d) => {
                await api(`/requests/${id}/proposals`, "POST", {
                  ...d,
                  currencyCode: r.currencyCode,
                });
                setProposal(false);
                await cache.invalidateQueries();
              }}
            />
          </section>
        )}
        <section className="panel">
          <h2>
            {t("proposals")} ({r.proposals.length})
          </h2>
          {r.proposals.length ? (
            r.proposals.map((p: any) => (
              <article className="proposal" key={p.id}>
                <div className="section-heading">
                  <Link to={`/professionals/${p.professional.id}`}>
                    <h3>{p.professional.displayName}</h3>
                  </Link>
                  <Status value={p.status} />
                </div>
                <p className="preserve">{p.description}</p>
                <div className="inline-meta">
                  <strong>
                    {money(p.estimatedPrice, p.currencyCode, i18n.language)}
                  </strong>
                  <span>{p.estimatedDuration}</span>
                </div>
                {p.status === "PENDING" &&
                  r.status === "OPEN" &&
                  (owner ? (
                    <>
                      <p className="muted">{t("acceptHelp")}</p>
                      <Action
                        path={`/proposals/${p.id}/accept`}
                        className="button"
                        onSuccess={(e) => nav(`/app/jobs/${e.id}`)}
                      >
                        {t("accept")}
                      </Action>
                    </>
                  ) : (
                    <Action path={`/proposals/${p.id}/withdraw`}>
                      {t("withdraw")}
                    </Action>
                  ))}
              </article>
            ))
          ) : (
            <Empty text={t("noProposals")} />
          )}
        </section>
        {owner && r.status === "OPEN" && (
          <section className="panel">
            <h2>{t("requestPhotos")}</h2>
            <ImageUpload endpoint={`/requests/${id}/images`} />
          </section>
        )}
        {r.images.length > 0 && (
          <section className="panel">
            <h2>{t("requestPhotos")}</h2>
            <div className="portfolio-grid">
              {r.images.map((image: any) => (
                <div key={image.id}>
                  <PortfolioPhoto image={image} privateImage />
                  {owner && r.status === "OPEN" && (
                    <DeleteImage
                      endpoint={`/requests/${id}/images/${image.id}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
export function ImageUpload({
  endpoint,
  description = false,
}: {
  endpoint: string;
  description?: boolean;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        setPending(true);
        setError(null);
        const data = new FormData();
        data.append("file", file);
        if (description && caption) data.append("description", caption);
        void api(endpoint, "POST", data)
          .then(() => {
            setFile(null);
            URL.revokeObjectURL(preview);
            setPreview("");
            return cache.invalidateQueries();
          })
          .catch(setError)
          .finally(() => setPending(false));
      }}
    >
      <p className="muted">{t("imageHelp")}</p>
      <label>
        {t("upload")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (preview) URL.revokeObjectURL(preview);
            setFile(f ?? null);
            setPreview(f ? URL.createObjectURL(f) : "");
          }}
        />
      </label>
      {preview && (
        <img src={preview} alt={t("preview")} className="upload-preview" />
      )}
      {description && (
        <label>
          {t("caption")}
          <input
            value={caption}
            maxLength={300}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
      )}
      <ErrorBox error={error} />
      <button className="button" disabled={!file || pending}>
        {t(pending ? "loading" : "upload")}
      </button>
    </form>
  );
}
export function DeleteImage({ endpoint }: { endpoint: string }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <button
        className="text-button"
        onClick={() =>
          void api(endpoint, "DELETE")
            .then(() => cache.invalidateQueries())
            .catch(setError)
        }
      >
        {t("delete")}
      </button>
      <ErrorBox error={error} />
    </>
  );
}
export function Proposals() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["proposals", page],
    queryFn: () => api<Paginated>(`/proposals/mine?page=${page}`),
  });
  return (
    <>
      <PageTitle title={t("myProposals")} />
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loader />
      ) : (
        q.data && (
          <>
            {q.data.items.length ? (
              <div className="stack">
                {q.data.items.map((p) => (
                  <section className="panel" key={p.id}>
                    <div className="section-heading">
                      <Link to={`/app/requests/${p.requestId}`}>
                        <h2>{p.request.title}</h2>
                      </Link>
                      <Status value={p.status} />
                    </div>
                    <p>{p.description}</p>
                    <p>
                      {money(p.estimatedPrice, p.currencyCode, i18n.language)} ·{" "}
                      {p.estimatedDuration}
                    </p>
                    {p.status === "PENDING" && (
                      <Action path={`/proposals/${p.id}/withdraw`}>
                        {t("withdraw")}
                      </Action>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <Empty to="/app/opportunities" action={t("opportunities")} />
            )}
            <Pagination data={q.data} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
