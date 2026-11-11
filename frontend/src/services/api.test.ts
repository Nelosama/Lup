import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
vi.stubGlobal("document", { documentElement: { lang: "es" } });
let api: typeof import("./api");
beforeAll(async () => {
  api = await import("./api");
});
beforeEach(() => {
  vi.restoreAllMocks();
  api.setCsrf("session-csrf");
});
describe("authenticated API client", () => {
  it("sends credentials and CSRF in headers without persisting tokens", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetch);
    await api.api("/requests", "POST", { title: "work" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/requests",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "session-csrf" }),
      }),
    );
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it("allows the browser to encode multipart boundaries", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    await api.api("/professional/portfolio", "POST", new FormData());
    expect(fetch.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });
  it("treats an empty successful response as absent data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError("Empty body");
        },
      }),
    );
    expect(await api.api("/professional/me")).toBeNull();
  });
  it("surfaces permission failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      }),
    );
    await expect(api.api("/admin/users")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("formats money in its own currency and locale", () => {
    expect(api.money("1250.50", "EUR", "en-US")).toBe("€1,250.50");
    expect(api.money("1250.50", "HNL", "es-HN")).toContain("1,250.50");
  });
});

it("keeps a preferred calendar day stable while formatting instants in the user time zone", () => {
  api.setTimeZone("America/Bogota");
  expect(api.calendarDate("2026-10-16T00:00:00.000Z", "en-US")).toBe(
    "Oct 16, 2026",
  );
  expect(api.date("2026-10-16T00:00:00.000Z", "en-US")).toBe("Oct 15, 2026");
  api.setTimeZone("UTC");
});
