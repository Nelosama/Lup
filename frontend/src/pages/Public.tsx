import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Search as SearchIcon,
  Star,
  MessageSquare,
  Plus,
  MoveRight,
} from "lucide-react";
import { api, money, type Paginated } from "../services/api";
import { categoryName, useCatalog } from "../services/catalog";
import { useAuth } from "../app/auth";
import {
  Action,
  Avatar,
  Empty,
  ErrorBox,
  Loader,
  PageTitle,
  Pagination,
  ReportButton,
  Status,
} from "../components/ui";
import { SmartForm } from "../components/SmartForm";
function ProCard({ p }: { p: any }) {
  const { t, i18n } = useTranslation();
  return (
    <article className="pro-card">
      <div className="pro-card-top">
        <Avatar
          userId={p.userId}
          name={p.displayName}
          path={p.user.avatarPath}
          size="large"
        />
        <span className={`availability ${p.isAvailable ? "yes" : ""}`}>
          <span />
          {t(p.isAvailable ? "available" : "unavailable")}
        </span>
      </div>
      <Link to={`/professionals/${p.id}`}>
        <h3>{p.displayName}</h3>
      </Link>
      <p className="pro-specialty">
        {p.services[0]
          ? categoryName(p.services[0].category)
          : t("professional")}
      </p>
      <p className="location">
        <MapPin size={15} />
        {p.user.city?.name ?? p.areas[0]?.city?.name ?? "—"}
      </p>
      <p className="clamp-2">{p.biography}</p>
      {p.distanceKm != null && (
        <small className="distance-label">
          {new Intl.NumberFormat(i18n.language, {
            maximumFractionDigits: 1,
          }).format(p.distanceKm)}{" "}
          {t("distanceKm")}
        </small>
      )}
      <div className="pro-card-bottom">
        <span>
          {p.reviewCount ? (
            <>
              <Star size={15} />
              {new Intl.NumberFormat(i18n.language, {
                maximumFractionDigits: 1,
              }).format(p.rating)}{" "}
              <small>({p.reviewCount})</small>
            </>
          ) : (
            t("noReviews")
          )}
        </span>
        <Link
          className="round-link"
          to={`/professionals/${p.id}`}
          aria-label={t("view")}
        >
          <ArrowUpRight size={19} />
        </Link>
      </div>
    </article>
  );
}
export function Search() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const catalog = useCatalog();
  const query = useQuery({
    queryKey: ["professionals", params.toString()],
    queryFn: () => api<Paginated>(`/professionals?${params}`),
  });
  const set = (name: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(name, value);
    else p.delete(name);
    p.delete("page");
    if (name === "countryCode") {
      p.delete("cityId");
      p.delete("regionId");
    }
    if (name === "regionId") p.delete("cityId");
    setParams(p);
  };
  const country = catalog.countries.find(
    (c) => c.code === params.get("countryCode"),
  );
  const cities = catalog.cities.filter(
    (c) =>
      (!country || c.countryCode === country.code) &&
      (!params.get("regionId") || c.regionId === params.get("regionId")),
  );
  return (
    <div className="container section">
      <PageTitle
        title={t("search")}
        description={t("free")}
        action={
          <Link className="button secondary" to="/app/requests/new">
            {t("publish")}
            <Plus size={17} />
          </Link>
        }
      />
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          set("q", String(new FormData(e.currentTarget).get("q") ?? ""));
        }}
      >
        <SearchIcon size={20} />
        <input
          name="q"
          key={params.get("q")}
          defaultValue={params.get("q") ?? ""}
          aria-label={t("need")}
          placeholder={t("keyword")}
        />
        <button className="button">{t("find")}</button>
      </form>
      <div className="search-layout">
        <aside className="filters">
          <label>
            {t("category")}
            <select
              value={params.get("categoryId") ?? ""}
              onChange={(e) => set("categoryId", e.target.value)}
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
            {t("country")}
            <select
              value={params.get("countryCode") ?? ""}
              onChange={(e) => set("countryCode", e.target.value)}
            >
              <option value="">{t("anyCountry")}</option>
              {catalog.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {country && (
            <label>
              {t("region")}
              <select
                value={params.get("regionId") ?? ""}
                onChange={(e) => set("regionId", e.target.value)}
              >
                <option value="">{t("all")}</option>
                {country.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t("city")}
            <select
              value={params.get("cityId") ?? ""}
              onChange={(e) => set("cityId", e.target.value)}
            >
              <option value="">{t("anyCity")}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("zone")}
            <input
              defaultValue={params.get("zone") ?? ""}
              key={params.get("zone")}
              maxLength={100}
              onBlur={(e) => {
                if ((params.get("zone") ?? "") !== e.target.value)
                  set("zone", e.target.value);
              }}
            />
          </label>
          <details className="distance-filter">
            <summary>{t("distanceFilters")}</summary>
            <p className="muted">{t("distanceNote")}</p>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const p = new URLSearchParams(params);
                for (const key of ["latitude", "longitude", "radiusKm"])
                  p.set(key, String(data.get(key)));
                p.delete("page");
                setParams(p);
              }}
            >
              {[
                ["latitude", -90, 90],
                ["longitude", -180, 180],
                ["radiusKm", 1, 500],
              ].map(([name, min, max]) => (
                <label key={name}>
                  {t(String(name))}
                  <input
                    type="number"
                    step="any"
                    name={String(name)}
                    required
                    min={Number(min)}
                    max={Number(max)}
                    defaultValue={params.get(String(name)) ?? ""}
                  />
                </label>
              ))}
              <button className="button secondary">{t("find")}</button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  const p = new URLSearchParams(params);
                  ["latitude", "longitude", "radiusKm"].forEach((k) =>
                    p.delete(k),
                  );
                  p.delete("page");
                  setParams(p);
                }}
              >
                {t("clearDistance")}
              </button>
            </form>
          </details>
        </aside>
        <div>
          <ErrorBox error={query.error || catalog.error} />
          {query.isPending ? (
            <Loader />
          ) : (
            query.data && (
              <>
                <p className="result-count">
                  {query.data.total} {t("professional").toLowerCase()}
                  {query.data.total !== 1 ? "s" : ""}
                </p>
                {query.data.items.length ? (
                  <div className="pro-grid">
                    {query.data.items.map((p) => (
                      <ProCard key={p.id} p={p} />
                    ))}
                  </div>
                ) : (
                  <Empty
                    text={t("emptySearch")}
                    to="/app/requests/new"
                    action={t("publish")}
                  />
                )}
                <Pagination
                  data={query.data}
                  onChange={(p) =>
                    setParams({
                      ...Object.fromEntries(params),
                      page: String(p),
                    })
                  }
                />
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
export function PortfolioPhoto({
  image,
  privateImage = false,
}: {
  image: { id: string; description?: string };
  privateImage?: boolean;
}) {
  const q = useQuery({
    queryKey: ["image", image.id],
    queryFn: () =>
      api(`/${privateImage ? "request-images" : "images"}/${image.id}`),
    staleTime: 480000,
  });
  return (
    <figure className="portfolio-photo">
      {q.data ? (
        <img src={q.data.url} alt={image.description ?? ""} loading="lazy" />
      ) : q.isPending ? (
        <Loader />
      ) : (
        <ErrorBox error={q.error} />
      )}
      {image.description && <figcaption>{image.description}</figcaption>}
    </figure>
  );
}
export function Profile() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const [hire, setHire] = useState(false);
  const { countries } = useCatalog();
  const q = useQuery({
    queryKey: ["profile", id],
    queryFn: () => api(`/professionals/${id}`),
  });
  const [reviewPage, setReviewPage] = useState(1);
  const reviews = useQuery({
    queryKey: ["reviews", q.data?.userId, reviewPage],
    queryFn: () =>
      api<Paginated>(`/reviews/user/${q.data.userId}?page=${reviewPage}`),
    enabled: !!q.data,
  });
  if (q.isPending) return <Loader />;
  if (q.error)
    return (
      <div className="container section">
        <ErrorBox error={q.error} />
      </div>
    );
  const p = q.data;
  return (
    <div className="container section">
      <Link className="text-link" to="/search">
        ← {t("search")}
      </Link>
      <div className="profile-header">
        <Avatar
          userId={p.userId}
          name={p.displayName}
          path={p.user.avatarPath}
          size="huge"
        />
        <div>
          <span className="eyebrow">{t("professional")}</span>
          <h1>{p.displayName}</h1>
          <p className="location">
            <MapPin size={17} />
            {p.user.city?.name ?? "—"} ·{" "}
            {t(p.isAvailable ? "available" : "unavailable")}
          </p>
          <span>
            {p.reviewCount ? (
              <>
                <Star size={16} />
                {new Intl.NumberFormat(i18n.language, {
                  maximumFractionDigits: 1,
                }).format(p.rating)}{" "}
                ({p.reviewCount})
              </>
            ) : (
              t("noReviews")
            )}
          </span>
        </div>
        <div className="profile-actions">
          {user && user.id !== p.userId ? (
            <>
              <Action
                path="/conversations"
                body={{ professionalId: p.id }}
                onSuccess={(r) => nav(`/app/messages/${r.id}`)}
                className="button"
              >
                <MessageSquare size={17} />
                {t("contact")}
              </Action>
              <button
                className="button secondary"
                onClick={() => setHire(!hire)}
              >
                {t("hire")}
              </button>
            </>
          ) : !user ? (
            <Link className="button" to={`/login?next=/professionals/${p.id}`}>
              {t("contactLogin")}
            </Link>
          ) : (
            <Link className="button" to="/app/professional">
              {t("save")}
            </Link>
          )}
        </div>
      </div>
      <div className="profile-layout">
        <div className="stack">
          <section className="panel">
            <h2>{t("about")}</h2>
            <p className="preserve">{p.biography}</p>
            <h3>{t("declared")}</h3>
            <p className="preserve">{p.experienceDescription}</p>
            <Status value={p.verificationStatus} />
            <p className="muted">
              {t("completedJobs")}: {p.completedJobs}
            </p>
            <p>
              {t("coverage")}:{" "}
              {p.areas
                .map(
                  (a: any) => `${a.city.name}${a.zone ? ` · ${a.zone}` : ""}`,
                )
                .join(", ") || "—"}
            </p>
          </section>
          <section className="panel">
            <h2>{t("services")}</h2>
            {p.services.map((s: any) => (
              <Link className="service-row" key={s.id} to={`/services/${s.id}`}>
                <div>
                  <h3>{s.title}</h3>
                  <span className="muted">{categoryName(s.category)}</span>
                </div>
                <span>
                  {s.indicativePrice
                    ? money(s.indicativePrice, s.currencyCode, i18n.language)
                    : ""}
                  <MoveRight size={18} />
                </span>
              </Link>
            ))}
          </section>
          <section className="panel">
            <h2>{t("portfolio")}</h2>
            {p.portfolio.length ? (
              <div className="portfolio-grid">
                {p.portfolio.map((image: any) => (
                  <PortfolioPhoto key={image.id} image={image} />
                ))}
              </div>
            ) : (
              <p className="muted">{t("noPortfolio")}</p>
            )}
          </section>
          <section className="panel">
            <h2>{t("reviews")}</h2>
            {p.reviewCount > 0 && (
              <details className="review-stats">
                <summary>{t("ratingDistribution")}</summary>
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count =
                    p.distribution.find((d: any) => d.rating === rating)
                      ?._count ?? 0;
                  return (
                    <div className="rating-row" key={rating}>
                      <span>★ {rating}</span>
                      <meter
                        min={0}
                        max={p.reviewCount}
                        value={count}
                        aria-label={`${rating}: ${count}`}
                      />
                      <span>{count}</span>
                    </div>
                  );
                })}
                <h3>{t("ratingTrend")}</h3>
                {p.trend.map((row: any) => (
                  <div className="list-row" key={row.month}>
                    <span>
                      {new Intl.DateTimeFormat(i18n.language, {
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(row.month))}
                    </span>
                    <span>
                      ★{" "}
                      {new Intl.NumberFormat(i18n.language, {
                        maximumFractionDigits: 1,
                      }).format(row.rating)}{" "}
                      ({row.count})
                    </span>
                  </div>
                ))}
              </details>
            )}
            <ErrorBox error={reviews.error} />
            {reviews.data?.items.map((r: any) => (
              <article className="review" key={r.id}>
                <div>
                  <strong>{r.reviewer.name}</strong>
                  <span>
                    <Star size={15} />
                    {r.rating}/5
                  </span>
                </div>
                <p>{r.comment}</p>
                <small>
                  {new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: "medium",
                  }).format(new Date(r.createdAt))}
                </small>
                {user && <ReportButton targetType="REVIEW" targetId={r.id} />}
              </article>
            ))}
            {reviews.data?.total === 0 && <p>{t("noReviews")}</p>}
            {reviews.data && (
              <Pagination data={reviews.data} onChange={setReviewPage} />
            )}
          </section>
        </div>
        <aside className="stack">
          {hire && (
            <section className="panel">
              <h2>{t("hire")}</h2>
              <SmartForm
                fields={[
                  { name: "title", label: "title", min: 5, max: 120 },
                  {
                    name: "currencyCode",
                    label: "currency",
                    options: Intl.supportedValuesOf("currency").map((c) => ({
                      value: c,
                      label: c,
                    })),
                  },
                ]}
                initial={{
                  currencyCode: countries.find(
                    (c) => c.code === user?.countryCode,
                  )?.currencyCode,
                }}
                submit="hire"
                onSubmit={async (d) => {
                  const r = await api("/engagements/direct", "POST", {
                    ...d,
                    professionalId: p.id,
                  });
                  nav(`/app/jobs/${r.id}`);
                }}
              />
            </section>
          )}
          <section className="panel safety-card">
            <h3>{t("safety")}</h3>
            <p>{t("platformNotice")}</p>
            <Link to="/safety" className="text-link">
              {t("safety")}
              <ArrowUpRight size={16} />
            </Link>
          </section>
          {user && user.id !== p.userId && (
            <div className="actions">
              <ReportButton targetType="PROFILE" targetId={p.id} />
              <Action path={`/blocks/${p.userId}`}>{t("block")}</Action>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
export function ServiceDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const q = useQuery({
    queryKey: ["service", id],
    queryFn: () => api(`/services/${id}`),
  });
  if (q.isPending) return <Loader />;
  return (
    <div className="container narrow section">
      <ErrorBox error={q.error} />
      {q.data && (
        <>
          <p className="eyebrow">{categoryName(q.data.category)}</p>
          <PageTitle title={q.data.title} />
          <section className="panel stack">
            <p className="preserve">{q.data.description}</p>
            {q.data.indicativePrice && (
              <p>
                {t("indicative")}:{" "}
                <strong>
                  {money(
                    q.data.indicativePrice,
                    q.data.currencyCode,
                    i18n.language,
                  )}
                </strong>
              </p>
            )}
            <Link
              className="button"
              to={`/professionals/${q.data.professional.id}`}
            >
              {q.data.professional.displayName}
              <ArrowUpRight size={18} />
            </Link>
            <p className="muted">{t("platformNotice")}</p>
          </section>
        </>
      )}
    </div>
  );
}
export function Information() {
  const { t } = useTranslation();
  const path = window.location.pathname;
  const legal = path.includes("/legal/");
  const type = path.split("/").pop() ?? "terms";
  return (
    <div className="container narrow section">
      <PageTitle
        title={t(
          legal ? type : path.includes("safety") ? "safetyTitle" : "how",
        )}
      />
      {legal ? (
        <>
          <div className="alert">{t("legalDraft")}</div>
          {[1, 2, 3].map((n) => (
            <section key={n} className="section-small prose">
              <h2>
                {t(
                  `legal${type === "privacy" ? "Privacy" : type === "community" ? "Community" : "Terms"}${n}Title`,
                )}
              </h2>
              <p>
                {t(
                  `legal${type === "privacy" ? "Privacy" : type === "community" ? "Community" : "Terms"}${n}Text`,
                )}
              </p>
            </section>
          ))}
        </>
      ) : path.includes("safety") ? (
        <div className="stack prose">
          <p>{t("safetyText")}</p>
          <p>{t("safetyReport")}</p>
          <p>{t("platformNotice")}</p>
        </div>
      ) : (
        <div className="stack">
          {[1, 2, 3].map((n) => (
            <section key={n} className="panel">
              <span className="step-number">0{n}</span>
              <h2>{t(`step${n}`)}</h2>
              <p>{t(`step${n}text`)}</p>
            </section>
          ))}
          <Link className="button" to="/search">
            {t("search")}
            <ArrowRight size={18} />
          </Link>
        </div>
      )}
    </div>
  );
}
