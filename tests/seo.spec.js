const { test, expect } = require("@playwright/test");

const { PREVIEW, PRODUCTION_INDEXABLE } = require("./site-state");

const HOST = "https://www.yg-powerclean.de";
const ALL_PAGES = ["/", "/impressum.html", "/datenschutz.html"];

async function attribute(page, selector, name = "content") {
  return page.locator(selector).first().getAttribute(name);
}

test.describe("every page", () => {
  for (const path of ALL_PAGES) {
    test(`${path} declares language, viewport and theme colour`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "de");
      expect(await attribute(page, 'meta[name="viewport"]')).toContain(
        "width=device-width",
      );
      expect(await attribute(page, 'meta[name="theme-color"]')).toBe("#020409");
      await expect(page.locator("head > title")).not.toBeEmpty();
    });
  }
});

test.describe("start page metadata", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("names the production url as its canonical", async ({ page }) => {
    expect(await attribute(page, 'link[rel="canonical"]', "href")).toBe(
      `${HOST}/`,
    );
  });

  test("the robots directive follows the site state", async ({ page }) => {
    const content = (await attribute(page, 'meta[name="robots"]')) || "";
    expect(/noindex/i.test(content), `robots: ${content}`).toBe(PREVIEW);
  });

  test("title and description stay within search result limits", async ({
    page,
  }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(20);
    expect(title.length).toBeLessThanOrEqual(65);

    const description = await attribute(page, 'meta[name="description"]');
    expect(description.length).toBeGreaterThanOrEqual(70);
    expect(description.length).toBeLessThanOrEqual(165);
  });

  test("open graph is complete and absolute", async ({ page }) => {
    const tags = {
      "og:title": /PowerClean/,
      "og:type": /^website$/,
      "og:locale": /^de_DE$/,
      "og:site_name": /^YG PowerClean$/,
    };
    for (const [property, pattern] of Object.entries(tags)) {
      expect(
        await attribute(page, `meta[property="${property}"]`),
        `fehlt oder falsch: ${property}`,
      ).toMatch(pattern);
    }
    expect(
      (await attribute(page, 'meta[property="og:description"]')).length,
    ).toBeGreaterThanOrEqual(60);
    expect(await attribute(page, 'meta[property="og:url"]')).toBe(`${HOST}/`);
    expect(await attribute(page, 'meta[property="og:image"]')).toBe(
      `${HOST}/assets/og-image.png`,
    );
    expect(await attribute(page, 'meta[property="og:image:width"]')).toBe(
      "1200",
    );
    expect(await attribute(page, 'meta[property="og:image:height"]')).toBe(
      "630",
    );
  });

  test("twitter card mirrors the open graph tags", async ({ page }) => {
    expect(await attribute(page, 'meta[name="twitter:card"]')).toBe(
      "summary_large_image",
    );
    expect(await attribute(page, 'meta[name="twitter:image"]')).toBe(
      `${HOST}/assets/og-image.png`,
    );
  });

  test("the referenced og image exists", async ({ page, request }) => {
    const url = await attribute(page, 'meta[property="og:image"]');
    const response = await request.get(url.replace(HOST, ""));
    expect(response.status()).toBe(200);
  });
});

test.describe("structured data", () => {
  let data;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    data = JSON.parse(
      await page.locator('script[type="application/ld+json"]').innerText(),
    );
  });

  test("is valid json describing a local business", () => {
    expect(data["@context"]).toBe("https://schema.org");
    expect([].concat(data["@type"])).toContain("LocalBusiness");
    expect(data.name).toBe("YG PowerClean");
    expect(data.description.length).toBeGreaterThan(40);
    expect(data.url).toBe(`${HOST}/`);
    expect(data.image).toBe(`${HOST}/assets/og-image.png`);
  });

  test("withholds the street address exactly like the visible page", () => {
    const serialised = JSON.stringify(data);
    expect(serialised).not.toMatch(/streetAddress/);
    expect(serialised).not.toMatch(/"geo"/);
    expect(serialised).not.toMatch(/postalCode/);
    expect(data.address.addressLocality).toBeTruthy();
    expect(data.address.addressCountry).toBe("DE");
  });

  test("names the area served and the opening hours", () => {
    expect(Array.isArray(data.areaServed)).toBe(true);
    expect(data.areaServed.length).toBeGreaterThanOrEqual(3);
    expect(data.openingHours.length).toBeGreaterThan(0);
  });

  test("telephone matches the link on the page", async ({ page }) => {
    const href = await page
      .locator('#kontakt a[href^="tel:"]')
      .first()
      .getAttribute("href");
    expect(data.telephone.replace(/\s/g, "")).toBe(href.replace("tel:", ""));
  });

  test("claims no qualification the owner does not hold", () => {
    expect(JSON.stringify(data)).not.toMatch(/meister/i);
  });
});

test.describe("sitemap coverage", () => {
  test("every page in the sitemap answers", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) {
      const response = await request.get(location.replace(HOST, ""));
      expect(response.status(), `${location} antwortet nicht`).toBe(200);
    }
  });

  test("exactly the pages meant for the index are listed", async ({
    request,
  }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const listed = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
      match[1].replace(HOST, ""),
    );
    expect(listed.sort()).toEqual([...PRODUCTION_INDEXABLE].sort());
  });

  test("every page outside that list refuses the index", async ({
    request,
  }) => {
    for (const path of ALL_PAGES) {
      if (PRODUCTION_INDEXABLE.includes(path)) continue;
      const html = await (await request.get(path)).text();
      const robots = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
      expect(robots ? robots[1] : "", `${path} fehlt noindex`).toMatch(
        /noindex/i,
      );
    }
  });
});

test.describe("footer", () => {
  for (const path of ALL_PAGES) {
    test(`${path} shows the current year, filled in by script`, async ({
      page,
    }) => {
      await page.goto(path);
      const year = await page.locator("#current-year").innerText();
      expect(Number(year)).toBe(new Date().getFullYear());
    });
  }
});
