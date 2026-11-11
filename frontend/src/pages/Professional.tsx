import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, ArrowUp } from "lucide-react";
import { api, money } from "../services/api";
import { useAuth } from "../app/auth";
import { useCatalog, categoryName } from "../services/catalog";
import { SmartForm, type Field } from "../components/SmartForm";
import { Empty, ErrorBox, Loader, PageTitle, Status } from "../components/ui";
import { PortfolioPhoto } from "./Public";
import { DeleteImage, ImageUpload } from "./Requests";
export function ProfessionalProfile() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [zoneError, setZoneError] = useState<unknown>(null);
  const catalog = useCatalog();
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["myProfile"],
    queryFn: () => api("/professional/me"),
  });
  if (q.isPending || catalog.loading) return <Loader />;
  const p = q.data;
  return (
    <>
      <PageTitle
        title={t("profile")}
        description={t("profileHelp")}
        action={
          p && (
            <Link className="button secondary" to={`/professionals/${p.id}`}>
              {t("view")}
            </Link>
          )
        }
      />
      <ErrorBox error={q.error || catalog.error} />
      <section className="panel form-panel">
        {p && <Status value={p.verificationStatus} />}
        <SmartForm
          fields={[
            { name: "displayName", label: "displayName", min: 2, max: 100 },
            {
              name: "biography",
              label: "biography",
              type: "textarea",
              min: 20,
              max: 3000,
            },
            {
              name: "experienceDescription",
              label: "experience",
              type: "textarea",
              optional: true,
              max: 2000,
            },
            {
              name: "cityIds",
              label: "coverage",
              type: "multi",
              options: catalog.cities.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.countryCode})`,
              })),
            },
            { name: "isAvailable", label: "availability", type: "checkbox" },
          ]}
          initial={
            p
              ? { ...p, cityIds: p.areas.map((a: any) => a.cityId) }
              : {
                  displayName: user?.name,
                  cityIds: user?.cityId ? [user.cityId] : [],
                  isAvailable: true,
                }
          }
          submit="save"
          success="saved"
          onSubmit={async (d) => {
            await api("/professional/me", "PUT", {
              ...d,
              experienceDescription: d.experienceDescription ?? "",
            });
            await refresh();
            await cache.invalidateQueries();
          }}
        />
      </section>
      {p && (
        <section className="panel form-panel">
          <h2>{t("coverageZones")}</h2>
          <SmartForm
            fields={[
              {
                name: "cityId",
                label: "city",
                options: catalog.cities.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.countryCode})`,
                })),
              },
              { name: "zone", label: "zone", min: 2, max: 100 },
            ]}
            submit="save"
            success="saved"
            onSubmit={async (d) => {
              await api("/professional/areas", "POST", d);
              await cache.invalidateQueries();
            }}
          />
          <ErrorBox error={zoneError} />
          {p.areas
            .filter((a: any) => a.zone)
            .map((a: any) => (
              <div className="list-row" key={a.cityId + a.zone}>
                <span>
                  {catalog.cities.find((c) => c.id === a.cityId)?.name} ·{" "}
                  {a.zone}
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    void api("/professional/areas", "DELETE", {
                      cityId: a.cityId,
                      zone: a.zone,
                    })
                      .then(() => cache.invalidateQueries())
                      .catch(setZoneError)
                  }
                >
                  {t("delete")}
                </button>
              </div>
            ))}
        </section>
      )}
    </>
  );
}
export function ProfessionalServices() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const catalog = useCatalog();
  const cache = useQueryClient();
  const [editing, setEditing] = useState<any>(undefined);
  const q = useQuery({
    queryKey: ["myProfile"],
    queryFn: () => api("/professional/me"),
  });
  if (q.isPending || catalog.loading) return <Loader />;
  if (!q.data)
    return (
      <>
        <ErrorBox error={q.error} />
        <Empty
          text={t("noProfile")}
          to="/app/professional"
          action={t("createProfile")}
        />
      </>
    );
  const fields: Field[] = [
    { name: "title", label: "title", min: 4, max: 120 },
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
      max: 3000,
    },
    {
      name: "indicativePrice",
      label: "priceOptional",
      type: "number",
      optional: true,
    },
    {
      name: "currencyCode",
      label: "currency",
      options: Intl.supportedValuesOf("currency").map((c) => ({
        value: c,
        label: c,
      })),
    },
    { name: "active", label: "active", type: "checkbox" },
  ];
  return (
    <>
      <PageTitle
        title={t("myServices")}
        action={
          <button className="button" onClick={() => setEditing(null)}>
            <Plus size={17} />
            {t("addService")}
          </button>
        }
      />
      <ErrorBox error={q.error} />
      {editing !== undefined && (
        <section className="panel form-panel">
          <h2>{t(editing ? "editService" : "addService")}</h2>
          <SmartForm
            key={editing?.id ?? "new"}
            fields={fields}
            initial={
              editing ?? {
                currencyCode: catalog.countries.find(
                  (c) => c.code === user?.countryCode,
                )?.currencyCode,
                active: true,
              }
            }
            submit="save"
            onSubmit={async (d) => {
              await api(
                editing
                  ? `/professional/services/${editing.id}`
                  : "/professional/services",
                editing ? "PUT" : "POST",
                d,
              );
              setEditing(undefined);
              await cache.invalidateQueries();
            }}
          />
          <button className="text-button" onClick={() => setEditing(undefined)}>
            {t("cancel")}
          </button>
        </section>
      )}
      <div className="stack">
        {q.data.services.map((s: any) => (
          <section className="panel" key={s.id}>
            <div className="section-heading">
              <h2>{s.title}</h2>
              <span className="badge">
                {t(s.active ? "active" : "unavailable")}
              </span>
            </div>
            <p>{s.description}</p>
            <p>
              {s.indicativePrice &&
                money(s.indicativePrice, s.currencyCode, i18n.language)}
            </p>
            <button className="button secondary" onClick={() => setEditing(s)}>
              {t("editService")}
            </button>
          </section>
        ))}
      </div>
    </>
  );
}
export function Portfolio() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ["myProfile"],
    queryFn: () => api("/professional/me"),
  });
  if (q.isPending) return <Loader />;
  if (!q.data)
    return (
      <>
        <ErrorBox error={q.error} />
        <Empty
          text={t("noProfile")}
          to="/app/professional"
          action={t("createProfile")}
        />
      </>
    );
  return (
    <>
      <PageTitle title={t("portfolio")} />
      <section className="panel">
        <ImageUpload endpoint="/professional/portfolio" description />
      </section>
      <ErrorBox error={error} />
      <div className="portfolio-grid section-small">
        {q.data.portfolio.map((image: any) => (
          <div key={image.id} className="panel">
            <PortfolioPhoto image={image} />
            <div className="actions">
              <DeleteImage endpoint={`/professional/portfolio/${image.id}`} />
              <button
                className="text-button"
                onClick={() =>
                  void api("/professional/portfolio/order", "PATCH", {
                    ids: [
                      image.id,
                      ...q.data.portfolio
                        .filter((i: any) => i.id !== image.id)
                        .map((i: any) => i.id),
                    ],
                  })
                    .then(() => cache.invalidateQueries())
                    .catch(setError)
                }
              >
                <ArrowUp size={15} />
                {t("moveUp")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
