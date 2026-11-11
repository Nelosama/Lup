import "dotenv/config";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma.service";
import { MailService } from "../src/auth/mail.service";
import { StorageService, sanitizeImage } from "../src/storage/storage.service";
import { setup } from "../src/setup";
const origin = "http://localhost:5173";
type Session = { cookie: string; csrf: string; id: string; email: string };
describe("marketplace on real PostgreSQL", () => {
  let app: INestApplication,
    db: PrismaService,
    mail: MailService,
    client: Session,
    pro: Session,
    pro2: Session,
    outsider: Session,
    admin: Session;
  let city: any,
    category: any,
    profile: any,
    requestId: string,
    proposalId: string,
    jobId: string,
    conversationId: string,
    messageId: string,
    reviewId: string;
  // Public fixture identifiers cannot resemble phone numbers rejected by the privacy filter.
  const suffix = randomUUID().replace(/[0-9]/g, (n) =>
    String.fromCharCode(103 + Number(n)),
  );
  const assets = new Map<string, Buffer>();
  const call = (
    method: "get" | "post" | "put" | "patch" | "delete",
    path: string,
    s?: Session,
    data?: object,
  ) => {
    const agent = request(app.getHttpServer());
    let q = agent[method](`/api${path}`).set("Origin", origin);
    if (s) q = q.set("Cookie", s.cookie).set("X-CSRF-Token", s.csrf);
    return data === undefined ? q : q.send(data);
  };
  async function account(role = "CLIENT"): Promise<Session> {
    const email = `${role}-${randomUUID()}@example.com`.toLowerCase();
    const r = await call("post", "/auth/register", undefined, {
      name: `Test ${role}`,
      email,
      password: "StrongPassphrase!42",
      countryCode: "ES",
      cityId: city.id,
      accountType: role,
    });
    expect(r.status).toBe(201);
    const delivery = mail.deliveries.find(
      (x) => x.email === email && x.purpose === "VERIFY_EMAIL",
    )!;
    expect(delivery).toBeDefined();
    await call("post", "/auth/verify-email", undefined, {
      token: delivery.token,
    }).expect(201);
    await call("post", "/auth/verify-email", undefined, {
      token: delivery.token,
    }).expect(400);
    const login = await call("post", "/auth/login", undefined, {
      email,
      password: "StrongPassphrase!42",
    }).expect(201);
    return {
      cookie: login.headers["set-cookie"][0].split(";")[0],
      csrf: login.body.csrfToken,
      id: login.body.user.id,
      email,
    };
  }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("/lup_test"))
      throw new Error(
        "Integration tests require the isolated lup_test database",
      );
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StorageService)
      .useValue({
        upload: async (b: Buffer, scope: string) => {
          const p = `${scope}/${randomUUID()}.webp`;
          assets.set(p, await sanitizeImage(b));
          return p;
        },
        remove: async (p: string) => {
          assets.delete(p);
        },
        url: async (p: string) => `https://test-storage.invalid/${p}`,
      })
      .compile();
    app = mod.createNestApplication({ bodyParser: false });
    setup(app);
    await app.init();
    db = app.get(PrismaService);
    mail = app.get(MailService);
    city = await db.city.findFirstOrThrow({ where: { countryCode: "ES" } });
    category = await db.category.findUniqueOrThrow({
      where: { slug: "painting" },
    });
  }, 30000);
  afterAll(async () => {
    await app?.close();
  });
  it("documents request fields, public authentication and protected CSRF contracts", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/docs-json")
      .expect(200);
    const doc = response.body;
    expect(doc.components.schemas.RegisterDto.properties.email.format).toBe(
      "email",
    );
    expect(
      doc.components.schemas.RegisterDto.properties.password.minLength,
    ).toBe(12);
    expect(doc.paths["/api/auth/register"].post.security).toEqual([]);
    expect(
      doc.paths["/api/requests"].post.parameters.some(
        (p: any) => p.name === "X-CSRF-Token" && p.required,
      ),
    ).toBe(true);
  });
  it("registers, verifies and signs in clients and professionals with HttpOnly cookies", async () => {
    client = await account();
    pro = await account("PROFESSIONAL");
    pro2 = await account("PROFESSIONAL");
    outsider = await account();
    const r = await call("get", "/auth/me", client).expect(200);
    expect(r.body.user.email).toBe(client.email);
    expect(client.cookie).toContain("lup_session=");
  });
  it("rejects role injection, CSRF, unauthorized and foreign origins", async () => {
    await call("post", "/auth/register", undefined, {
      name: "Attack",
      email: `attack-${suffix}@example.com`,
      password: "StrongPassphrase!42",
      countryCode: "ES",
      roles: ["SUPER_ADMIN"],
    }).expect(400);
    await request(app.getHttpServer())
      .patch("/api/users/me")
      .set("Cookie", client.cookie)
      .set("Origin", origin)
      .send({ name: "changed" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: client.email, password: "StrongPassphrase!42" })
      .expect(403);
    await call("get", "/users/me").expect(401);
  });
  it("recovers passwords with single-use tokens and revokes all sessions", async () => {
    await call("post", "/auth/forgot-password", undefined, {
      email: outsider.email,
    }).expect(201);
    const t = mail.deliveries.find(
      (x) => x.email === outsider.email && x.purpose === "RESET_PASSWORD",
    )!;
    await call("post", "/auth/reset-password", undefined, {
      token: t.token,
      password: "NewStrongPassphrase!42",
    }).expect(201);
    await call("post", "/auth/reset-password", undefined, {
      token: t.token,
      password: "NewStrongPassphrase!42",
    }).expect(400);
    await call("get", "/auth/me", outsider).expect(401);
    const r = await call("post", "/auth/login", undefined, {
      email: outsider.email,
      password: "NewStrongPassphrase!42",
    }).expect(201);
    outsider = {
      ...outsider,
      cookie: r.headers["set-cookie"][0].split(";")[0],
      csrf: r.body.csrfToken,
    };
  });
  it("edits account and rejects country-city mismatches", async () => {
    await call("patch", "/users/me", client, {
      name: "Test client",
      phone: "+34612345678",
      timezone: "Europe/Madrid",
      locale: "en",
    }).expect(200);
    await call("patch", "/users/me", client, { countryCode: "HN" }).expect(400);
  });
  it("rejects contact details in public names and supports removing private phone data", async () => {
    await call("patch", "/users/me", client, {
      name: "Contact me at +34 612 345 678",
    }).expect(400);
    await call("post", "/auth/register", undefined, {
      name: "person@example.com",
      email: `private-name-${randomUUID()}@example.com`,
      password: "StrongPassphrase!42",
      countryCode: "ES",
    }).expect(400);
    const cleared = await call("patch", "/users/me", client, {
      phone: null,
    }).expect(200);
    expect(cleared.body.phone).toBeNull();
  });
  it("creates professional profiles and publishes a service", async () => {
    for (const s of [pro, pro2]) {
      const r = await call("put", "/professional/me", s, {
        displayName: `Lup painter ${suffix}`,
        biography: "Professional painting and furniture restoration services.",
        experienceDescription: "Five years of declared experience",
        isAvailable: true,
        cityIds: [city.id],
      })
        .expect((response) => {
          if (response.status !== 200)
            throw new Error(
              `Profile creation failed: ${JSON.stringify(response.body)}`,
            );
        })
        .expect(200);
      if (s === pro) profile = r.body;
    }
    await call("post", "/professional/services", pro, {
      categoryId: category.id,
      title: `Wall painting ${suffix}`,
      description: "Preparation and interior wall painting with clear scope.",
      indicativePrice: "125.50",
      currencyCode: "EUR",
    }).expect(201);
  });
  it("validates, uploads, orders and removes portfolio images through a test storage adapter", async () => {
    const png = await sharp({
      create: { width: 50, height: 50, channels: 3, background: "green" },
    })
      .png()
      .toBuffer();
    const avatar = await call("post", "/users/me/avatar", pro)
      .attach("file", png, "avatar.png")
      .expect(201);
    expect(avatar.body.avatarPath).toContain("avatars/");
    await call("get", `/avatars/${pro.id}`).expect(200);
    const r = await call("post", "/professional/portfolio", pro)
      .attach("file", png, "work.png")
      .expect(201);
    await call("post", "/professional/portfolio", pro)
      .field("description", "Contact +34 612 345 678")
      .attach("file", png, "private-caption.png")
      .expect(400);
    await call("patch", "/professional/portfolio/order", pro, {
      ids: [r.body.id],
    }).expect(200);
    await call("post", "/professional/portfolio", pro)
      .attach("file", Buffer.from("executable"), "fake.jpg")
      .expect(400);
    await call("delete", `/professional/portfolio/${r.body.id}`, client).expect(
      404,
    );
    await call("delete", `/professional/portfolio/${r.body.id}`, pro).expect(
      200,
    );
  });
  it("searches by category and city, without exposing private data or fake ratings", async () => {
    const r = await call(
      "get",
      `/professionals?categoryId=${category.id}&cityId=${city.id}&q=${suffix}`,
    ).expect(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].rating).toBeNull();
    expect(JSON.stringify(r.body)).not.toContain(pro.email);
    expect(JSON.stringify(r.body)).not.toContain("passwordHash");
    const detail = await call("get", `/professionals/${profile.id}`).expect(
      200,
    );
    expect(detail.body.user.phone).toBeUndefined();
  });
  it("bounds service publication and keeps public search responses compact", async () => {
    const p = await db.professionalProfile.findUniqueOrThrow({
      where: { userId: pro.id },
    });
    const existing = await db.professionalService.count({
      where: { professionalId: p.id },
    });
    const temporary = Array.from({ length: 30 - existing }, (_, i) => ({
      id: randomUUID(),
      professionalId: p.id,
      categoryId: category.id,
      title: `Additional test service ${String.fromCharCode(65 + i)}`,
      description: "A test-only service with detailed scope and boundaries.",
      currencyCode: "EUR",
    }));
    await db.professionalService.createMany({ data: temporary });
    try {
      await call("post", "/professional/services", pro, {
        categoryId: category.id,
        title: "An additional service beyond the quota",
        description: "This publication exceeds the configured service quota.",
        currencyCode: "EUR",
      }).expect(400);
      const results = await call("get", `/professionals?q=${suffix}`).expect(
        200,
      );
      const item = results.body.items.find((x: any) => x.id === p.id);
      expect(item.services).toHaveLength(1);
      expect(item.portfolio).toBeUndefined();
      expect(item.experienceDescription).toBeUndefined();
      expect(item.biography.length).toBeLessThanOrEqual(220);
    } finally {
      await db.professionalService.deleteMany({
        where: { id: { in: temporary.map((s) => s.id) } },
      });
    }
  });
  it("publishes and edits a service request, rejects private public content", async () => {
    const data = {
      categoryId: category.id,
      title: "Paint the living room",
      description: "The living room needs a new coat of paint and preparation.",
      countryCode: "ES",
      cityId: city.id,
      approximateLocation: "Central district",
      budgetMin: "100",
      budgetMax: "300",
      currencyCode: "EUR",
      preferredDate: "2026-10-16",
    };
    const r = await call("post", "/requests", client, data).expect(201);
    requestId = r.body.id;
    expect(r.body.preferredDate).toBe("2026-10-16T00:00:00.000Z");
    await call("post", "/requests", client, {
      ...data,
      preferredDate: "2026-02-30",
    }).expect(400);
    await call("post", "/requests", client, {
      ...data,
      preferredDate: "2026-10-16T00:00:00Z",
    }).expect(400);
    await call("patch", `/requests/${requestId}`, client, {
      ...data,
      title: "Paint the living room walls",
    }).expect(200);
    await call("post", "/requests", client, {
      ...data,
      description: "Call me at +34 612 345 678 to discuss this job",
    }).expect(400);
  });
  it("sends proposals and prevents self-proposals and duplicates", async () => {
    const data = {
      description: "I can prepare and paint the room with two coats.",
      estimatedPrice: "200",
      currencyCode: "EUR",
      estimatedDuration: "Two days",
    };
    const r = await call(
      "post",
      `/requests/${requestId}/proposals`,
      pro,
      data,
    ).expect(201);
    proposalId = r.body.id;
    await call("post", `/requests/${requestId}/proposals`, pro, data).expect(
      409,
    );
    await call("post", `/requests/${requestId}/proposals`, pro2, {
      ...data,
      estimatedPrice: "180",
    }).expect(201);
  });
  it("prevents foreign acceptance and concurrently accepts exactly one proposal", async () => {
    await call("post", `/proposals/${proposalId}/accept`, outsider).expect(404);
    const r = await call("get", `/requests/${requestId}`, client).expect(200);
    const second = r.body.proposals.find((p: any) => p.id !== proposalId).id;
    const results = await Promise.all([
      call("post", `/proposals/${proposalId}/accept`, client),
      call("post", `/proposals/${second}/accept`, client),
    ]);
    expect(results.filter((x) => x.status === 201)).toHaveLength(1);
    expect(results.filter((x) => x.status === 400)).toHaveLength(1);
    const job = results.find((x) => x.status === 201)!.body;
    jobId = job.id;
    conversationId = job.conversation.id;
    if (job.professionalId !== pro.id) {
      [pro, pro2] = [pro2, pro];
    }
    expect(await db.engagement.count({ where: { requestId } })).toBe(1);
    expect(
      await db.proposal.count({ where: { requestId, status: "ACCEPTED" } }),
    ).toBe(1);
    await call("post", `/requests/${requestId}/proposals`, outsider, {
      description: "An invalid late offer for this closed request.",
      estimatedPrice: "150",
      currencyCode: "EUR",
      estimatedDuration: "One day",
    }).expect(400);
  });
  it("authorizes messaging, unread counts and forbids access to other conversations", async () => {
    const r = await call(
      "post",
      `/conversations/${conversationId}/messages`,
      client,
      { body: "Let us agree on the schedule." },
    ).expect(201);
    messageId = r.body.id;
    await call("get", `/conversations/${conversationId}/messages`, pro).expect(
      200,
    );
    await call(
      "get",
      `/conversations/${conversationId}/messages`,
      outsider,
    ).expect(404);
    await call("post", `/conversations/${conversationId}/messages`, outsider, {
      body: "Unauthorized",
    }).expect(404);
    const list = await call("get", "/conversations", pro).expect(200);
    expect(
      list.body.items.find((x: any) => x.id === conversationId).unread,
    ).toBe(1);
    await call("post", `/conversations/${conversationId}/read`, pro).expect(
      201,
    );
  });
  it("requires mutual completion and prevents fake/duplicate reviews", async () => {
    await call("post", "/reviews", client, {
      engagementId: jobId,
      rating: 5,
      comment: "Good communication",
    }).expect(400);
    await call("post", `/engagements/${jobId}/state`, client, {
      action: "START",
    }).expect(201);
    await call("post", `/engagements/${jobId}/state`, client, {
      action: "COMPLETE",
    }).expect(201);
    expect(
      (await call("get", `/engagements/${jobId}`, client)).body.status,
    ).toBe("IN_PROGRESS");
    await call("post", `/engagements/${jobId}/state`, pro, {
      action: "COMPLETE",
    }).expect(201);
    const r = await call("post", "/reviews", client, {
      engagementId: jobId,
      rating: 5,
      comment: "Clear communication and agreed work completed.",
    }).expect(201);
    reviewId = r.body.id;
    await call("post", "/reviews", client, {
      engagementId: jobId,
      rating: 5,
      comment: "Duplicate",
    }).expect(409);
    await call("post", "/reviews", outsider, {
      engagementId: jobId,
      rating: 5,
      comment: "Fake",
    }).expect(404);
  });
  it("supports direct contact and prevents duplicate active direct engagements", async () => {
    const p = await db.professionalProfile.findUniqueOrThrow({
      where: { userId: pro.id },
    });
    await call("post", "/conversations", client, {
      professionalId: p.id,
    }).expect(201);
    const d = {
      professionalId: p.id,
      title: "Restore a wooden table",
      currencyCode: "EUR",
    };
    const r = await call("post", "/engagements/direct", client, d).expect(201);
    await call("post", "/engagements/direct", client, d).expect(409);
    await call("post", `/engagements/${r.body.id}/state`, client, {
      action: "START",
    }).expect(400);
    await call("post", `/engagements/${r.body.id}/state`, pro, {
      action: "AGREE",
    }).expect(201);
  });
  it("blocks interaction in both directions and allows unblocking", async () => {
    await call("post", `/blocks/${pro.id}`, client).expect(201);
    await call("post", `/conversations/${conversationId}/messages`, pro, {
      body: "Blocked",
    }).expect(403);
    await call("post", `/conversations/${conversationId}/messages`, client, {
      body: "Blocked too",
    }).expect(403);
    await call("delete", `/blocks/${pro.id}`, client).expect(200);
  });
  it("reports abuse, enforces admin permissions, audits narrow message access and moderation", async () => {
    await call("get", "/admin/analytics", client).expect(403);
    await call("get", "/moderation/reports", client).expect(403);
    admin = await account();
    await db.userRole.create({
      data: { userId: admin.id, role: "SUPER_ADMIN" },
    });
    const r = await call("post", "/reports", client, {
      targetType: "MESSAGE",
      targetId: messageId,
      reason: "This message needs moderator review.",
    }).expect(201);
    await call("post", `/moderation/reports/${r.body.id}/evidence`, admin, {
      reason: "Investigating the specific participant report.",
    }).expect(201);
    expect(
      await db.auditLog.count({
        where: { actorId: admin.id, action: "REPORTED_MESSAGE_ACCESS" },
      }),
    ).toBe(1);
    await call("post", `/moderation/reports/${r.body.id}/resolve`, admin, {
      action: "HIDE_CONTENT",
      reason: "Message violates the published community rules.",
    }).expect(201);
    await call(
      "get",
      `/conversations/${conversationId}/messages`,
      admin,
    ).expect(404);
    expect(
      (await call("get", `/conversations/${conversationId}/messages`, pro)).body
        .items,
    ).toHaveLength(0);
    const reviewReport = await call("post", "/reports", pro, {
      targetType: "REVIEW",
      targetId: reviewId,
      reason: "Review requires a moderation assessment.",
    }).expect(201);
    await call(
      "post",
      `/moderation/reports/${reviewReport.body.id}/resolve`,
      admin,
      { action: "DISMISS", reason: "Review complies with community rules." },
    ).expect(201);
    const metrics = await call("get", "/admin/analytics", admin).expect(200);
    expect(metrics.body.reportedEngagements).toBeGreaterThan(0);
    expect(metrics.body.independentlyVerifiedJobs).toBeNull();
  });
  it("keeps client feedback out of professional reputation for dual-role accounts", async () => {
    const professional = await db.professionalProfile.findUniqueOrThrow({
      where: { userId: pro.id },
    });
    const other = await db.professionalProfile.findUniqueOrThrow({
      where: { userId: pro2.id },
    });
    const job = await call("post", "/engagements/direct", pro, {
      professionalId: other.id,
      title: "A separate furniture restoration job",
      currencyCode: "EUR",
    }).expect(201);
    await call("post", `/engagements/${job.body.id}/state`, pro2, {
      action: "AGREE",
    }).expect(201);
    await call("post", `/engagements/${job.body.id}/state`, pro2, {
      action: "START",
    }).expect(201);
    await call("post", `/engagements/${job.body.id}/state`, pro, {
      action: "COMPLETE",
    }).expect(201);
    await call("post", `/engagements/${job.body.id}/state`, pro2, {
      action: "COMPLETE",
    }).expect(201);
    await call("post", "/reviews", pro2, {
      engagementId: job.body.id,
      rating: 1,
      comment:
        "This feedback describes the client, not their professional work.",
    }).expect(201);
    const detail = await call(
      "get",
      `/professionals/${professional.id}`,
    ).expect(200);
    expect(detail.body.rating).toBe(5);
    expect(detail.body.reviewCount).toBe(1);
    expect(
      detail.body.trend.reduce((sum: number, r: any) => sum + r.count, 0),
    ).toBe(1);
    const listing = await call("get", `/professionals?q=${suffix}`).expect(200);
    expect(
      listing.body.items.find((p: any) => p.id === professional.id).rating,
    ).toBe(5);
    const reviews = await call("get", `/reviews/user/${pro.id}`).expect(200);
    expect(reviews.body.total).toBe(1);
  });
  it("searches zones and computes distances only from available coordinates", async () => {
    const p = await db.professionalProfile.findUniqueOrThrow({
      where: { userId: pro.id },
    });
    await call("post", "/professional/areas", pro, {
      cityId: city.id,
      zone: "Test district",
    }).expect(201);
    const zone = await call(
      "get",
      `/professionals?cityId=${city.id}&zone=Test%20district`,
    ).expect(200);
    expect(zone.body.items.some((x: any) => x.id === p.id)).toBe(true);
    await call("get", "/professionals?latitude=0").expect(400);
    const absent = await call(
      "get",
      `/professionals?latitude=0&longitude=0&radiusKm=1&cityId=${city.id}`,
    ).expect(200);
    expect(absent.body.total).toBe(0);
    // Synthetic coordinates exist in the isolated test database only.
    await db.city.update({
      where: { id: city.id },
      data: { latitude: "0", longitude: "0" },
    });
    try {
      const geo = await call(
        "get",
        `/professionals?latitude=0&longitude=0&radiusKm=1&cityId=${city.id}`,
      ).expect(200);
      const found = geo.body.items.find((x: any) => x.id === p.id);
      expect(found.distanceKm).toBe(0);
    } finally {
      await db.city.update({
        where: { id: city.id },
        data: { latitude: null, longitude: null },
      });
    }
    await call("delete", "/professional/areas", pro, {
      cityId: city.id,
      zone: "Test district",
    }).expect(200);
  });
  it("invalidates verification after changes to reviewed information", async () => {
    const p = await db.professionalProfile.findUniqueOrThrow({
      where: { userId: pro.id },
      include: { areas: true },
    });
    await call("post", `/admin/professionals/${p.id}/verification`, client, {
      status: "VERIFIED",
      evidence: "Unauthorized attempted verification without permission.",
    }).expect(403);
    await call("post", `/admin/professionals/${p.id}/verification`, admin, {
      status: "VERIFIED",
      evidence:
        "Test-only review of declared skills following documented criteria.",
    }).expect(201);
    expect(
      (await call("get", `/professionals/${p.id}`).expect(200)).body
        .verificationStatus,
    ).toBe("VERIFIED");
    const r = await call("put", "/professional/me", pro, {
      displayName: p.displayName,
      biography:
        "Updated declared professional experience and painting services.",
      experienceDescription: p.experienceDescription,
      isAvailable: true,
      cityIds: [...new Set(p.areas.map((a) => a.cityId))],
    }).expect(200);
    expect(r.body.verificationStatus).toBe("UNVERIFIED");
  });
  it("queues encrypted mail and processes provider acceptance without pretending external delivery", async () => {
    const before = { ...process.env };
    const fetchMock = jest.spyOn(globalThis, "fetch");
    try {
      process.env.MAIL_MODE = "resend";
      process.env.RESEND_API_KEY = "test-only-api-key";
      process.env.MAIL_FROM = "test@example.com";
      process.env.MAIL_ENCRYPTION_KEY = "c".repeat(64);
      await call("post", "/auth/forgot-password", undefined, {
        email: client.email,
      }).expect(201);
      const queued = await db.mailOutbox.findFirstOrThrow({
        orderBy: { createdAt: "desc" },
      });
      expect(queued.ciphertext).not.toContain(client.email);
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ id: "test-provider-acceptance" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await mail.drain();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({ method: "POST" }),
      );
      expect(
        await db.mailOutbox.findUnique({ where: { id: queued.id } }),
      ).toBeNull();
    } finally {
      fetchMock.mockRestore();
      process.env = before;
    }
  });
  it("administers translated categories and enabled countries with backend permissions", async () => {
    const data = {
      slug: `test-${suffix}`,
      active: false,
      requiresLicense: false,
      position: 30,
      translations: [
        { locale: "es", name: "Categoría de prueba" },
        { locale: "en", name: "Test category" },
      ],
    };
    await call("post", "/admin/categories", client, data).expect(403);
    const created = await call("post", "/admin/categories", admin, data).expect(
      201,
    );
    await call("patch", `/admin/categories/${created.body.id}`, admin, {
      ...data,
      active: true,
    }).expect(200);
    expect(
      (await call("get", "/categories")).body.some(
        (c: any) => c.id === created.body.id,
      ),
    ).toBe(true);
    await call("patch", `/admin/categories/${created.body.id}`, admin, {
      ...data,
      active: true,
      requiresLicense: true,
    }).expect(400);
    await call(
      "patch",
      `/admin/categories/${created.body.id}`,
      admin,
      data,
    ).expect(200);
    const country = await db.country.findUniqueOrThrow({
      where: { code: "BR" },
    });
    try {
      await call("patch", "/admin/countries/BR", admin, {
        enabled: false,
      }).expect(200);
      expect(
        (await call("get", "/locations")).body.some(
          (c: any) => c.code === "BR",
        ),
      ).toBe(false);
    } finally {
      await call("patch", "/admin/countries/BR", admin, {
        enabled: country.enabled,
      }).expect(200);
    }
    await call("get", "/admin/professionals", admin).expect(200);
    await call("get", "/admin/clients", admin).expect(200);
    await call("get", "/admin/audit", admin).expect(200);
  });
  it("preserves database acceptance and rating constraints", async () => {
    const rejected = await db.proposal.findFirstOrThrow({
      where: { requestId, status: "REJECTED" },
    });
    await expect(
      db.proposal.update({
        where: { id: rejected.id },
        data: { status: "ACCEPTED" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.review.update({ where: { id: reviewId }, data: { rating: 6 } }),
    ).rejects.toThrow();
  });
  it("blocks anonymous table reads through PostgreSQL RLS", async () => {
    const role = "lup_rls_" + randomUUID().replaceAll("-", "");
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN`);
      await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await tx.$executeRawUnsafe(
        `GRANT SELECT ON "User", "Session", "Message" TO "${role}"`,
      );
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      const users = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(*) AS count FROM "User"`;
      const sessions = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(*) AS count FROM "Session"`;
      const messages = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(*) AS count FROM "Message"`;
      expect(users[0].count).toBe(0n);
      expect(sessions[0].count).toBe(0n);
      expect(messages[0].count).toBe(0n);
      await tx.$executeRawUnsafe("RESET ROLE");
      await tx.$executeRawUnsafe(`DROP OWNED BY "${role}"`);
      await tx.$executeRawUnsafe(`DROP ROLE "${role}"`);
    });
  });
  it("suspends reported accounts and revokes their sessions", async () => {
    const r = await call("post", "/reports", client, {
      targetType: "USER",
      targetId: outsider.id,
      reason: "Repeated abusive contact for moderator assessment.",
    }).expect(201);
    await call("post", `/moderation/reports/${r.body.id}/resolve`, admin, {
      action: "SUSPEND_USER",
      reason: "Suspension after documented assessment of abusive behavior.",
    }).expect(201);
    await call("get", "/auth/me", outsider).expect(401);
    await call("post", `/admin/users/${outsider.id}/status`, admin, {
      status: "ACTIVE",
      reason: "Account restored following a successful moderation appeal.",
    }).expect(201);
  });
  it("lists and revokes own sessions, changes password and deactivates accounts", async () => {
    const list = await call("get", "/users/me/sessions", pro2).expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    expect(JSON.stringify(list.body)).not.toContain("tokenHash");
    await call("post", "/auth/change-password", pro2, {
      currentPassword: "StrongPassphrase!42",
      password: "ChangedPassphrase!42",
    }).expect(201);
    await call("get", "/auth/me", pro2).expect(401);
    const login = await call("post", "/auth/login", undefined, {
      email: pro2.email,
      password: "ChangedPassphrase!42",
    }).expect(201);
    pro2 = {
      ...pro2,
      cookie: login.headers["set-cookie"][0].split(";")[0],
      csrf: login.body.csrfToken,
    };
    const latest = await call("get", "/users/me/sessions", pro2).expect(200);
    await call(
      "delete",
      `/users/me/sessions/${latest.body[0].id}`,
      client,
    ).expect(200);
    await call("get", "/auth/me", pro2).expect(200);
    await call("post", "/users/me/deactivate", pro2).expect(201);
    await call("get", "/auth/me", pro2).expect(401);
    const publicId = (
      await db.professionalProfile.findUniqueOrThrow({
        where: { userId: pro2.id },
      })
    ).id;
    await call("get", `/professionals/${publicId}`).expect(404);
  });
  it("rate limits repeated authentication attempts", async () => {
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const r = await call("post", "/auth/login", undefined, {
        email: "missing@example.com",
        password: "WrongPassword!42",
      });
      statuses.push(r.status);
    }
    expect(statuses).toContain(429);
  });
});
