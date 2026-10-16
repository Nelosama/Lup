import { createBrowserRouter, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout, AppLayout } from "../components/Layout";
import { Protected } from "./auth";
import { Home, Categories } from "../pages/Home";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader } from "../components/ui";
const Search = lazy(() =>
  import("../pages/Public").then((m) => ({ default: m.Search })),
);
const Profile = lazy(() =>
  import("../pages/Public").then((m) => ({ default: m.Profile })),
);
const ServiceDetail = lazy(() =>
  import("../pages/Public").then((m) => ({ default: m.ServiceDetail })),
);
const Information = lazy(() =>
  import("../pages/Public").then((m) => ({ default: m.Information })),
);
const AuthPage = lazy(() =>
  import("../pages/Auth").then((m) => ({ default: m.AuthPage })),
);
const Dashboard = lazy(() =>
  import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Settings = lazy(() =>
  import("../pages/Dashboard").then((m) => ({ default: m.Settings })),
);
const Notifications = lazy(() =>
  import("../pages/Dashboard").then((m) => ({ default: m.Notifications })),
);
const MyReviews = lazy(() =>
  import("../pages/Dashboard").then((m) => ({ default: m.MyReviews })),
);
const RequestList = lazy(() =>
  import("../pages/Requests").then((m) => ({ default: m.RequestList })),
);
const RequestForm = lazy(() =>
  import("../pages/Requests").then((m) => ({ default: m.RequestForm })),
);
const RequestDetail = lazy(() =>
  import("../pages/Requests").then((m) => ({ default: m.RequestDetail })),
);
const Proposals = lazy(() =>
  import("../pages/Requests").then((m) => ({ default: m.Proposals })),
);
const ProfessionalProfile = lazy(() =>
  import("../pages/Professional").then((m) => ({
    default: m.ProfessionalProfile,
  })),
);
const ProfessionalServices = lazy(() =>
  import("../pages/Professional").then((m) => ({
    default: m.ProfessionalServices,
  })),
);
const Portfolio = lazy(() =>
  import("../pages/Professional").then((m) => ({ default: m.Portfolio })),
);
const JobList = lazy(() =>
  import("../pages/Jobs").then((m) => ({ default: m.JobList })),
);
const JobDetail = lazy(() =>
  import("../pages/Jobs").then((m) => ({ default: m.JobDetail })),
);
const Messages = lazy(() =>
  import("../pages/Messages").then((m) => ({ default: m.Messages })),
);
const Admin = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.Admin })),
);
function Wait({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loader />}>{children}</Suspense>;
}
function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="container section">
      <h1>{t("notFound")}</h1>
      <Link className="button" to="/">
        {t("goHome")}
      </Link>
    </div>
  );
}
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      {
        path: "search",
        element: (
          <Wait>
            <Search />
          </Wait>
        ),
      },
      { path: "categories", element: <Categories /> },
      {
        path: "professionals/:id",
        element: (
          <Wait>
            <Profile />
          </Wait>
        ),
      },
      {
        path: "services/:id",
        element: (
          <Wait>
            <ServiceDetail />
          </Wait>
        ),
      },
      ...["how-it-works", "safety", "legal/:type"].map((path) => ({
        path,
        element: (
          <Wait>
            <Information />
          </Wait>
        ),
      })),
      ...(["login", "register", "forgot", "reset", "verify"] as const).map(
        (mode) => ({
          path: {
            login: "login",
            register: "register",
            forgot: "forgot-password",
            reset: "reset-password",
            verify: "verify-email",
          }[mode],
          element: (
            <Wait>
              <AuthPage mode={mode} />
            </Wait>
          ),
        }),
      ),
      {
        path: "app",
        element: (
          <Protected>
            <AppLayout />
          </Protected>
        ),
        children: [
          {
            index: true,
            element: (
              <Wait>
                <Dashboard />
              </Wait>
            ),
          },
          {
            path: "requests",
            element: (
              <Wait>
                <RequestList />
              </Wait>
            ),
          },
          {
            path: "requests/new",
            element: (
              <Wait>
                <RequestForm />
              </Wait>
            ),
          },
          {
            path: "requests/:id",
            element: (
              <Wait>
                <RequestDetail />
              </Wait>
            ),
          },
          {
            path: "requests/:id/edit",
            element: (
              <Wait>
                <RequestForm />
              </Wait>
            ),
          },
          {
            path: "opportunities",
            element: (
              <Wait>
                <RequestList opportunities />
              </Wait>
            ),
          },
          {
            path: "proposals",
            element: (
              <Wait>
                <Proposals />
              </Wait>
            ),
          },
          {
            path: "professional",
            element: (
              <Wait>
                <ProfessionalProfile />
              </Wait>
            ),
          },
          {
            path: "services",
            element: (
              <Wait>
                <ProfessionalServices />
              </Wait>
            ),
          },
          {
            path: "portfolio",
            element: (
              <Wait>
                <Portfolio />
              </Wait>
            ),
          },
          {
            path: "jobs",
            element: (
              <Wait>
                <JobList />
              </Wait>
            ),
          },
          {
            path: "jobs/:id",
            element: (
              <Wait>
                <JobDetail />
              </Wait>
            ),
          },
          {
            path: "messages",
            element: (
              <Wait>
                <Messages />
              </Wait>
            ),
          },
          {
            path: "messages/:id",
            element: (
              <Wait>
                <Messages />
              </Wait>
            ),
          },
          {
            path: "reviews",
            element: (
              <Wait>
                <MyReviews />
              </Wait>
            ),
          },
          {
            path: "notifications",
            element: (
              <Wait>
                <Notifications />
              </Wait>
            ),
          },
          {
            path: "settings",
            element: (
              <Wait>
                <Settings />
              </Wait>
            ),
          },
          {
            path: "admin",
            element: (
              <Protected roles={["ADMIN", "SUPER_ADMIN", "MODERATOR"]}>
                <Wait>
                  <Admin />
                </Wait>
              </Protected>
            ),
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
