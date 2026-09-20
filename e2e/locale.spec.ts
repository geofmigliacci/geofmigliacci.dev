// Playwright's `test`, not smoke.ts's: most of these never build a browser page.
import { expect, test } from "@playwright/test";

// `extraHTTPHeaders`, not `locale`: that option reaches browser pages only.
test.describe("a French browser", () => {
  test.use({ extraHTTPHeaders: { "accept-language": "fr-FR,fr;q=0.9" } });

  test("lands on the French site from a bare path", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.headers().location).toBe("/fr");
  });

  test("keeps the path it asked for across the redirect", async ({
    request,
  }) => {
    const response = await request.get("/blog", { maxRedirects: 0 });

    expect(response.headers().location).toBe("/fr/blog");
  });
});

test.describe("an English browser", () => {
  test.use({ extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" } });

  test("lands on the English site from a bare path", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.headers().location).toBe("/en");
  });
});

test.describe("a stored preference", () => {
  test.use({
    extraHTTPHeaders: {
      "accept-language": "fr-FR,fr;q=0.9",
      cookie: "NEXT_LOCALE=en",
    },
  });

  test("beats the Accept-Language header", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.headers().location).toBe("/en");
  });
});

test("the negotiated redirect varies on what decided it", async ({
  request,
}) => {
  const response = await request.get("/", { maxRedirects: 0 });
  const vary = response.headers().vary ?? "";

  expect(vary.toLowerCase()).toContain("accept-language");
});

test("every locale is reachable directly", async ({ request }) => {
  for (const path of ["/en", "/fr"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});

test("each locale declares the other as its alternate", async ({ page }) => {
  await page.goto("/en");

  await expect(
    page.locator('link[rel="alternate"][hreflang="fr"]'),
  ).toHaveAttribute("href", /\/fr$/);
  await expect(
    page.locator('link[rel="alternate"][hreflang="x-default"]'),
  ).toHaveAttribute("href", /\/en$/);
});

test("an untranslated post serves the original inside the other locale", async ({
  page,
}) => {
  const response = await page.goto("/en/blog/ef-core-lazy-loading");

  expect(response?.status()).toBe(200);
  await expect(page.getByText("has not been translated yet")).toBeVisible();

  await expect(page.locator('div.prose[lang="fr"]')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/fr\/blog\/ef-core-lazy-loading$/,
  );
});

test("an untranslated post claims no alternate it cannot back", async ({
  page,
}) => {
  await page.goto("/fr/blog/ef-core-lazy-loading");

  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('link[rel="alternate"][hreflang="x-default"]'),
  ).toHaveAttribute("href", /\/fr\/blog\/ef-core-lazy-loading$/);
});

test("the header carries no hreflang of its own", async ({ request }) => {
  const response = await request.get("/fr/blog/ef-core-lazy-loading");

  // Next preloads fonts through the same header, so it is not simply absent.
  expect(response.headers().link ?? "").not.toContain("hreflang");
});

test("the listing marks a post it only falls back to", async ({ page }) => {
  await page.goto("/en/blog");

  await expect(page.getByText("In French").first()).toBeVisible();
});

test("switching language keeps the path and stores the choice", async ({
  page,
  context,
}) => {
  await page.goto("/fr/blog");
  await page.getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL(/\/en\/blog$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const cookies = await context.cookies();
  expect(cookies.find(({ name }) => name === "NEXT_LOCALE")?.value).toBe("en");
});

test("the sitemap lists a post only under the locale that wrote it", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();

  expect(sitemap).toContain("/fr/blog/ef-core-lazy-loading");
  expect(sitemap).not.toContain("/en/blog/ef-core-lazy-loading");
});
