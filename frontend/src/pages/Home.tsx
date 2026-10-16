import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MapPin,
  Search as SearchIcon,
  PaintRoller,
  Sparkles,
  Hammer,
  Leaf,
  Truck,
  Monitor,
  Camera,
  Wrench,
  Plus,
} from "lucide-react";
import { categoryName, useCatalog, type Category } from "../services/catalog";
import { ErrorBox, Loader, PageTitle } from "../components/ui";
function CategoryCard({
  category,
  index,
}: {
  category: Category;
  index: number;
}) {
  const Icon =
    (
      {
        painting: PaintRoller,
        carpentry: Hammer,
        gardening: Leaf,
        cleaning: Sparkles,
        moving: Truck,
        "computer-repair": Monitor,
        photography: Camera,
      } as Record<string, typeof Wrench>
    )[category.slug] ?? Wrench;
  return (
    <Link className="category-card" to={`/search?categoryId=${category.id}`}>
      <span className={`category-icon tone-${index % 4}`}>
        <Icon size={27} strokeWidth={1.6} />
      </span>
      <span>{categoryName(category)}</span>
      <ArrowUpRight size={18} />
    </Link>
  );
}
function HomeArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-circle" />
      <svg viewBox="0 0 450 450" className="house-art">
        <path
          d="M70 230 225 94l155 136"
          fill="#f4a373"
          stroke="#173b32"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M100 219v179h249V219L225 110z"
          fill="#fff8e8"
          stroke="#173b32"
          strokeWidth="5"
        />
        <path
          d="M123 184 225 94l125 110"
          stroke="#173b32"
          strokeWidth="15"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M268 132V88h35v75"
          fill="#d1e1f7"
          stroke="#173b32"
          strokeWidth="5"
        />
        <rect
          x="140"
          y="235"
          width="64"
          height="70"
          rx="3"
          fill="#c1dae8"
          stroke="#173b32"
          strokeWidth="5"
        />
        <path d="M172 237v66m-30-34h60" stroke="#173b32" strokeWidth="4" />
        <path
          d="M252 398V284c0-34 57-34 57 0v114"
          fill="#a0c4ab"
          stroke="#173b32"
          strokeWidth="5"
        />
        <circle cx="295" cy="335" r="4" fill="#173b32" />
        <path
          d="M58 398h340"
          stroke="#173b32"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M78 397v-65c-37-6-44-59-26-73 25 12 42 39 26 73m0-14c12-50 49-59 53-34-2 23-25 44-53 48"
          fill="#587b58"
          stroke="#173b32"
          strokeWidth="4"
        />
        <path
          d="M340 395v-46m-15 0h31l-6 46h-19z"
          fill="#f4a373"
          stroke="#173b32"
          strokeWidth="4"
        />
        <path
          d="m338 347-15-37m19 34 19-46"
          stroke="#587b58"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="m349 207 22-12 23 42-22 12z"
          fill="#c6b4e8"
          stroke="#173b32"
          strokeWidth="4"
        />
        <path
          d="m380 245 17 33-30 17-9-16"
          fill="none"
          stroke="#173b32"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="m379 289 18 34"
          stroke="#173b32"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="m166 75 9-19m-45 48-18-8m248 271 16-6"
          stroke="#173b32"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <div className="art-tag tag-top">
        <span className="mini-icon">
          <Check size={18} />
        </span>
        <span>
          Hecho con talento
          <br />
          <strong>Made with skill.</strong>
        </span>
      </div>
      <div className="art-tag tag-bottom">
        <span className="mini-icon lavender">
          <Wrench size={22} />
        </span>
        <strong>
          Un buen comienzo.
          <br />A fresh start.
        </strong>
      </div>
      <span className="art-star">✳</span>
    </div>
  );
}
export function Home() {
  const { t } = useTranslation();
  const { categories, cities, error } = useCatalog();
  const nav = useNavigate();
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" />
              {t("tagline")}
            </div>
            <h1>
              {t("heroA")}
              <br />
              <span>{t("heroB")}</span>
            </h1>
            <p>{t("heroText")}</p>
            <form
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                nav(
                  `/search?${new URLSearchParams({ q: String(f.get("q")), cityId: String(f.get("cityId")) })}`,
                );
              }}
            >
              <label>
                <SearchIcon size={21} />
                <span className="sr-only">{t("need")}</span>
                <input name="q" placeholder={t("keyword")} />
              </label>
              <label>
                <MapPin size={20} />
                <span className="sr-only">{t("city")}</span>
                <select name="cityId">
                  <option value="">{t("anyCity")}</option>
                  {cities.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" aria-label={t("find")}>
                <ArrowRight size={23} />
              </button>
            </form>
            <div className="hero-meta">
              <span>
                <Check size={16} />
                {t("free")}
              </span>
              <Link to="/app/requests/new">
                {t("publish")}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <HomeArt />
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LUP / 01</p>
            <h2>{t("explore")}</h2>
            <p>{t("exploreText")}</p>
          </div>
          <Link className="text-link" to="/categories">
            {t("viewAll")}
            <ArrowRight size={18} />
          </Link>
        </div>
        <ErrorBox error={error} />
        <div className="category-grid">
          {categories.slice(0, 8).map((c, i) => (
            <CategoryCard key={c.id} category={c} index={i} />
          ))}
        </div>
      </section>
      <section className="how-section">
        <div className="container">
          <p className="eyebrow">LUP / 02</p>
          <h2>{t("how")}</h2>
          <div className="steps">
            {[1, 2, 3].map((n) => (
              <article key={n}>
                <span className="step-number">0{n}</span>
                <h3>{t(`step${n}`)}</h3>
                <p>{t(`step${n}text`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="pro-banner">
          <div>
            <span className="eyebrow">LUP / PRO</span>
            <h2>{t("proCta")}</h2>
            <p>{t("proText")}</p>
            <Link to="/app/professional" className="button lime">
              {t("createProfile")}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="pro-symbol" aria-hidden="true">
            <Wrench size={70} strokeWidth={1.1} />
            <Plus size={45} />
          </div>
        </div>
      </section>
    </>
  );
}
export function Categories() {
  const { t } = useTranslation();
  const { categories, error, loading } = useCatalog();
  return (
    <div className="container section">
      <PageTitle title={t("categories")} description={t("exploreText")} />
      <ErrorBox error={error} />
      {loading ? (
        <Loader />
      ) : (
        <div className="category-grid">
          {categories.map((c, i) => (
            <CategoryCard key={c.id} category={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
