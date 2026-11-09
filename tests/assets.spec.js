const { test, expect } = require("@playwright/test");

const { PREVIEW } = require("./site-state");

const DOMAIN = "https://www.yg-powerclean.de";

const STATIC_ASSETS = [
  "/assets/logo-full.svg",
  "/assets/logo-flat.svg",
  "/assets/logo-mono-white.svg",
  "/assets/logo-mark.svg",
  "/assets/favicon.svg",
  "/assets/favicon-32.png",
  "/assets/apple-touch-icon.png",
  "/assets/og-image.jpg",
  "/assets/yoldas.png",
  "/assets/yoldas-640.webp",
  "/assets/yoldas-640.jpg",
];

function pngSize(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function jpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("kein JPEG-Marker");
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("kein SOF-Segment gefunden");
}

test.describe("static assets", () => {
  for (const path of STATIC_ASSETS) {
    test(`${path} is served`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect((await response.body()).length).toBeGreaterThan(0);
    });
  }

  test("og-image has the dimensions required by Open Graph", async ({
    request,
  }) => {
    const response = await request.get("/assets/og-image.jpg");
    expect(jpegSize(await response.body())).toEqual({
      width: 1200,
      height: 630,
    });
  });

  test("apple-touch-icon is 180 by 180", async ({ request }) => {
    const response = await request.get("/assets/apple-touch-icon.png");
    expect(pngSize(await response.body())).toEqual({ width: 180, height: 180 });
  });

  test("favicon-32 is 32 by 32", async ({ request }) => {
    const response = await request.get("/assets/favicon-32.png");
    expect(pngSize(await response.body())).toEqual({ width: 32, height: 32 });
  });

  for (const variant of ["/assets/yoldas-640.webp", "/assets/yoldas-640.jpg"]) {
    test(`${variant} stays small enough to not dominate page weight`, async ({
      request,
    }) => {
      const response = await request.get(variant);
      expect(response.status()).toBe(200);
      const bytes = (await response.body()).length;
      expect(bytes).toBeGreaterThan(1024);
      expect(bytes).toBeLessThan(120 * 1024);
    });
  }

  test("the portrait the page delivers is not the untouched original", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const delivered = await page
      .locator(".portrait-frame img")
      .getAttribute("src");
    expect(delivered).not.toBe("assets/yoldas.png");
    const bytes = (await (await request.get(`/${delivered}`)).body()).length;
    expect(bytes).toBeLessThan(120 * 1024);
  });

  test("logo svgs keep text as text, not as paths", async ({ request }) => {
    const response = await request.get("/assets/logo-full.svg");
    const svg = await response.text();
    expect(svg).toContain("<text");
    expect(svg).toContain("SAUBER. STARK. ZUVERLÄSSIG.");
  });
});

test.describe("deployment files", () => {
  test("CNAME holds exactly one clean hostname", async ({ request }) => {
    const response = await request.get("/CNAME");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body.trim()).toBe("www.yg-powerclean.de");
    expect(body.trim().split("\n")).toHaveLength(1);
    expect(body.trim()).not.toMatch(/\s/);
  });

  test("robots.txt allows crawling and points at the sitemap", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
    expect(body).toContain(`Sitemap: ${DOMAIN}/sitemap.xml`);
  });

  test("sitemap is well formed and lists the three pages", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    );
    const locations = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locations).toEqual([`${DOMAIN}/`]);
    expect((body.match(/<url>/g) || []).length).toBe(
      (body.match(/<\/url>/g) || []).length,
    );
  });

  test("the sitemap lists no page that asks not to be indexed", async ({
    request,
  }) => {
    test.skip(PREVIEW, "Vorschau: die Startseite steht bewusst auf noindex");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
    for (const location of locations) {
      const html = await (await request.get(location.replace(DOMAIN, ""))).text();
      const robots = html.match(
        /<meta\s+name="robots"\s+content="([^"]*)"/i,
      );
      expect(
        robots ? robots[1] : "",
        `${location} steht in der Sitemap und auf noindex`,
      ).not.toMatch(/noindex/i);
    }
  });

  test("every sitemap host matches the CNAME host", async ({ request }) => {
    const cname = (await (await request.get("/CNAME")).text()).trim();
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const hosts = [...sitemap.matchAll(/<loc>https?:\/\/([^/]+)/g)].map(
      (m) => m[1],
    );
    expect(new Set(hosts)).toEqual(new Set([cname]));
  });
});
