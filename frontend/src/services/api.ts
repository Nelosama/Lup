import i18n from "../i18n";
let csrfToken = "";
let timeZone: string | undefined;
export function setTimeZone(value: string) {
  timeZone = value;
}
export function setCsrf(token: string) {
  csrfToken = token;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const base = import.meta.env.VITE_API_URL || "/api";
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new Error(i18n.t("networkError"));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key =
      res.status === 401
        ? "notAuthorized"
        : res.status === 403
          ? "forbidden"
          : res.status === 409
            ? "conflict"
            : res.status === 503
              ? "storageUnavailable"
              : res.status === 429
                ? "rateLimited"
                : null;
    throw new ApiError(
      res.status,
      key
        ? i18n.t(key)
        : Array.isArray(data?.message)
          ? data.message.join(". ")
          : data?.message || i18n.t("error"),
    );
  }
  return data;
}
export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  countryCode: string;
  cityId?: string;
  locale: string;
  timezone: string;
  emailVerifiedAt?: string;
  roles: { role: string }[];
  professional?: { id: string };
};
export type Paginated<T = any> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
export const money = (
  value: string | number | undefined | null,
  currency: string,
  locale: string,
) =>
  value == null
    ? ""
    : new Intl.NumberFormat(locale, { style: "currency", currency }).format(
        Number(value),
      );
export const date = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(
    new Date(value),
  );
