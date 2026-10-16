import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const outbox = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../backend/.local/e2e-outbox",
);
const password = "LupEndToEnd!2026";
async function verifyEmail(page: Page, email: string) {
  let url = "";
  await expect
    .poll(async () => {
      for (const file of await readdir(outbox).catch(() => [])) {
        const delivery = JSON.parse(
          await readFile(path.join(outbox, file), "utf8"),
        );
        if (delivery.to === email && delivery.subject === "VERIFY_EMAIL")
          url = delivery.url;
      }
      return url;
    })
    .not.toBe("");
  await page.goto(url);
  await page
    .getByRole("button", { name: "Verificar correo", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Correo verificado");
}
async function register(page: Page, email: string, role = "CLIENT") {
  await page.goto("/register");
  await page
    .getByLabel("Nombre", { exact: true })
    .fill(role === "CLIENT" ? "Cliente E2E" : "Profesional E2E");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByLabel("País", { exact: true }).selectOption("ES");
  await page.getByLabel("Quiero empezar como").selectOption(role);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Solicitud de registro");
  await verifyEmail(page, email);
  await login(page, email);
}
async function login(page: Page, email: string, passwordValue = password) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(passwordValue);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("home, category search, ES/EN and mobile navigation", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Hay alguien",
  );
  await page.getByRole("button", { name: "Idioma" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Someone knows",
  );
  await page.getByRole("button", { name: "Language" }).click();
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Pintura", exact: true }).click();
  await expect(page).toHaveURL(/search\?categoryId=/);
  await expect(
    page.getByRole("heading", { name: "Encontrar profesionales" }),
  ).toBeVisible();
  await noOverflow(page);
});
test("complete client/professional request, proposal, message, completion and review flow", async ({
  page,
  browser,
}, info) => {
  const suffix = `${Date.now()}-${info.project.name}`;
  const publicLabel =
    info.project.name === "mobile" ? "Prueba móvil" : "Prueba escritorio";
  const clientEmail = `client-${suffix}@example.com`;
  const proEmail = `pro-${suffix}@example.com`;
  let otherContext: BrowserContext | undefined;
  try {
    await register(page, clientEmail);
    await page.goto("/app/settings");
    await page
      .getByLabel("Ciudad", { exact: true })
      .selectOption({ label: "Madrid (ES)" });
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados");
    await page.goto("/app/requests/new");
    await page
      .getByLabel("Título", { exact: true })
      .fill(`Pintar sala ${publicLabel}`);
    await page
      .getByLabel("Categoría", { exact: true })
      .selectOption({ label: "Pintura" });
    await page
      .getByLabel("Descripción", { exact: true })
      .fill("Necesito preparar y pintar las paredes de una sala amplia.");
    await page
      .getByLabel("Ciudad", { exact: true })
      .selectOption({ label: "Madrid (ES)" });
    await page.getByLabel("Ubicación aproximada").fill("Distrito central");
    await page
      .getByRole("button", { name: "Publicar solicitud gratuita" })
      .click();
    await expect(page).toHaveURL(/\/app\/requests\/[a-f0-9-]+$/);
    const requestUrl = page.url();
    await noOverflow(page);
    otherContext = await browser.newContext({
      viewport:
        info.project.name === "mobile"
          ? { width: 393, height: 851 }
          : { width: 1280, height: 800 },
    });
    const proPage = await otherContext.newPage();
    await register(proPage, proEmail, "PROFESSIONAL");
    await proPage.goto("/app/professional");
    await proPage
      .getByLabel("Nombre profesional")
      .fill(`Pintura E2E ${publicLabel}`);
    await proPage
      .getByLabel("Cuéntales qué sabes hacer")
      .fill("Preparo y pinto espacios interiores con atención a los detalles.");
    await proPage
      .getByLabel("Experiencia declarada")
      .fill("Experiencia declarada en pintura interior.");
    await proPage
      .getByLabel("Ciudades de cobertura")
      .selectOption({ label: "Madrid (ES)" });
    await proPage.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(proPage.getByRole("status")).toContainText(
      "Cambios guardados",
    );
    await proPage.goto("/app/services");
    await proPage.getByRole("button", { name: "Publicar servicio" }).click();
    await proPage
      .getByLabel("Título", { exact: true })
      .fill("Pintura de interiores");
    await proPage
      .getByLabel("Categoría", { exact: true })
      .selectOption({ label: "Pintura" });
    await proPage
      .getByLabel("Descripción", { exact: true })
      .fill(
        "Pintura de paredes interiores y preparación cuidadosa de superficies.",
      );
    await proPage.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      proPage.getByRole("heading", { name: "Pintura de interiores" }),
    ).toBeVisible();
    await proPage.goto(requestUrl);
    await proPage
      .getByRole("button", { name: "Enviar propuesta", exact: true })
      .click();
    await proPage
      .getByLabel("Descripción", { exact: true })
      .fill("Puedo preparar y pintar las paredes en dos jornadas.");
    await proPage.getByLabel("Precio estimado").fill("180");
    await proPage.getByLabel("Duración estimada").fill("Dos días");
    await proPage
      .getByRole("button", { name: "Enviar propuesta", exact: true })
      .last()
      .click();
    await expect(proPage.getByText("Puedo preparar y pintar")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Aceptar propuesta" }).click();
    await expect(page).toHaveURL(/\/app\/jobs\/[a-f0-9-]+$/);
    const jobUrl = page.url();
    await page
      .locator(".workspace")
      .getByRole("link", { name: "Mensajes", exact: true })
      .click();
    await page
      .getByLabel("Escribe un mensaje")
      .fill("Confirmamos los detalles por aquí.");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      page
        .getByText("Confirmamos los detalles por aquí.", { exact: true })
        .last(),
    ).toBeVisible();
    await noOverflow(page);
    await proPage.goto(jobUrl);
    await proPage
      .locator(".workspace")
      .getByRole("link", { name: "Mensajes", exact: true })
      .click();
    await expect(
      proPage
        .getByText("Confirmamos los detalles por aquí.", { exact: true })
        .last(),
    ).toBeVisible();
    await proPage.goto(jobUrl);
    await proPage.getByRole("button", { name: "Iniciar trabajo" }).click();
    await expect(proPage.locator(".page-title")).toContainText("En curso");
    await proPage
      .getByRole("button", { name: "Confirmar finalización" })
      .click();
    await page.goto(jobUrl);
    await page.getByRole("button", { name: "Confirmar finalización" }).click();
    await expect(page.locator(".page-title")).toContainText("Completada");
    await page.getByLabel("Calificación", { exact: true }).selectOption("5");
    await page
      .getByLabel("Comentario", { exact: true })
      .fill("Comunicación clara y alcance acordado.");
    await page
      .getByRole("button", { name: "Publicar evaluación", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Evaluación · ★ 5/5" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/job-${info.project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Reportar", exact: true })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "lup_session")!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe("Lax");
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((k) => k !== "lup_language"),
      ),
    ).toEqual([]);
  } finally {
    await otherContext?.close();
  }
});

test("password recovery through the local mail adapter", async ({
  page,
}, info) => {
  const email = `recovery-${Date.now()}-${info.project.name}@example.com`;
  await register(page, email);
  await page.goto("/forgot-password");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "Solicitar enlace" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Si la cuenta es elegible",
  );
  let url = "";
  await expect
    .poll(async () => {
      for (const file of await readdir(outbox)) {
        const mail = JSON.parse(
          await readFile(path.join(outbox, file), "utf8"),
        );
        if (mail.to === email && mail.subject === "RESET_PASSWORD")
          url = mail.url;
      }
      return url;
    })
    .not.toBe("");
  await page.goto(url);
  const next = "LupNewPassphrase!2026";
  await page.getByLabel("Contraseña").fill(next);
  await page
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Contraseña actualizada",
  );
  await login(page, email, next);
});
