const { test, expect } = require("@playwright/test");

const PAGES = ["/", "/impressum.html", "/datenschutz.html"];
const WIDTHS = [320, 390, 768, 1024, 1280, 1440];

test.describe("responsive layout", () => {
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      test(`${path} has no horizontal overflow at ${width} pixels`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
          const root = document.documentElement;
          const offenders = [...document.querySelectorAll("body *")]
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return box.width > 0 && box.right > root.clientWidth + 1;
            })
            .map((element) => element.className || element.tagName);
          return {
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
            offenders: offenders.slice(0, 5),
          };
        });

        expect(
          result.scrollWidth,
          `überstehende Elemente: ${result.offenders.join(", ")}`,
        ).toBeLessThanOrEqual(result.clientWidth);
      });
    }
  }
});

test.describe("rendering", () => {
  for (const path of PAGES) {
    test(`${path} loads every referenced resource`, async ({ page }) => {
      const failures = [];
      page.on("response", (response) => {
        const url = response.url();
        if (response.status() >= 400 && url.startsWith("http://localhost")) {
          failures.push(`${response.status()} ${url}`);
        }
      });
      page.on("pageerror", (error) => failures.push(`JS: ${error.message}`));

      await page.goto(path, { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);

      expect(failures).toEqual([]);
    });
  }

  test("all images on the start page decode", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src),
    );
    expect(broken).toEqual([]);
  });

  test("interactive controls meet the minimum touch target", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll(".pc-button, .nav-toggle, .benefit")]
        .map((element) => ({
          name: element.className,
          box: element.getBoundingClientRect(),
        }))
        .filter(({ box }) => box.width > 0 && box.height < 44)
        .map(({ name }) => name),
    );
    expect(tooSmall).toEqual([]);
  });

  test("the services grid collapses to one column on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    const lefts = await page
      .locator(".service-card")
      .evaluateAll((cards) =>
        cards.map((card) => Math.round(card.getBoundingClientRect().left)),
      );
    expect(new Set(lefts).size).toBe(1);
  });
});
