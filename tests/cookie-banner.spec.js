const { test, expect } = require("@playwright/test");

const CONSENT_COOKIE = "yg_cookie_consent";

async function consentCookie(context) {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === CONSENT_COOKIE);
}

async function trackingRequests(page) {
  const seen = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/googletagmanager|google-analytics|connect\.facebook/.test(url)) {
      seen.push(url);
    }
  });
  return seen;
}

test.describe("cookie banner", () => {
  test("is shown on the first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#cookie-banner")).toBeVisible();
    await expect(page.locator("#cookie-banner")).toHaveAttribute(
      "role",
      "dialog",
    );
  });

  test("links to the privacy policy", async ({ page }) => {
    await page.goto("/");
    const link = page.locator('#cookie-banner a[href*="datenschutz"]');
    await expect(link).toHaveCount(1);
    await expect(link).toBeVisible();
  });

  test("rejecting is as easy as accepting", async ({ page }) => {
    await page.goto("/");
    const accept = page.locator("#cookie-accept");
    const decline = page.locator("#cookie-decline");
    await expect(accept).toBeVisible();
    await expect(decline).toBeVisible();

    const [acceptBox, declineBox] = await Promise.all([
      accept.boundingBox(),
      decline.boundingBox(),
    ]);
    expect(declineBox.height).toBe(acceptBox.height);
    expect(declineBox.width).toBeGreaterThan(acceptBox.width * 0.6);

    const fontSizes = await page.evaluate(() => [
      getComputedStyle(document.getElementById("cookie-accept")).fontSize,
      getComputedStyle(document.getElementById("cookie-decline")).fontSize,
    ]);
    expect(fontSizes[0]).toBe(fontSizes[1]);
  });

  test("loads no tracking before a decision is made", async ({ page }) => {
    const seen = await trackingRequests(page);
    await page.goto("/");
    await page.waitForTimeout(500);
    expect(seen).toEqual([]);
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");
    expect(await page.evaluate(() => typeof window.gtag)).toBe("undefined");
  });

  test("declining stores the decision and loads nothing", async ({
    page,
    context,
  }) => {
    const seen = await trackingRequests(page);
    await page.goto("/");
    await page.locator("#cookie-decline").click();
    await expect(page.locator("#cookie-banner")).toBeHidden();

    const cookie = await consentCookie(context);
    expect(cookie.value).toBe("declined");
    expect(cookie.sameSite).toBe("Lax");
    await page.waitForTimeout(300);
    expect(seen).toEqual([]);
  });

  test("accepting stores the decision", async ({ page, context }) => {
    await page.goto("/");
    await page.locator("#cookie-accept").click();
    await expect(page.locator("#cookie-banner")).toBeHidden();
    expect((await consentCookie(context)).value).toBe("accepted");
  });

  test("a stored decision keeps the banner away", async ({ page, context }) => {
    await context.addCookies([
      {
        name: CONSENT_COOKIE,
        value: "declined",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/");
    await expect(page.locator("#cookie-banner")).toBeHidden();
  });

  test("placeholder tracking ids never trigger a request", async ({ page }) => {
    const seen = await trackingRequests(page);
    await page.goto("/");
    await page.locator("#cookie-accept").click();
    await page.waitForTimeout(500);
    expect(seen).toEqual([]);
  });

  test("the decision expires so consent is asked again", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.locator("#cookie-accept").click();
    const cookie = await consentCookie(context);
    const days = (cookie.expires * 1000 - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(1);
    expect(days).toBeLessThanOrEqual(366);
  });
});

test.describe("cookie banner does not block the page", () => {
  test("footer links stay reachable while the banner is open", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#cookie-banner")).toBeVisible();

    for (const target of ["impressum.html", "datenschutz.html"]) {
      const link = page.locator(`.site-footer__links a[href="${target}"]`);
      await link.scrollIntoViewIfNeeded();
      const covered = await link.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return !element.contains(hit) && hit !== element;
      });
      expect(covered, `${target} liegt unter dem Banner`).toBe(false);
    }
  });

  test("the reserved space is released after a decision", async ({ page }) => {
    await page.goto("/");
    await page.locator("#cookie-accept").click();
    await expect(page.locator("#cookie-banner")).toBeHidden();
    const padding = await page.evaluate(
      () => getComputedStyle(document.body).paddingBottom,
    );
    expect(parseFloat(padding)).toBe(0);
  });
});

test.describe("withdrawing consent", () => {
  const PAGES = ["/", "/impressum.html", "/datenschutz.html"];

  for (const path of PAGES) {
    test(`${path} offers a control to withdraw`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("[data-consent-revoke]").first()).toBeVisible();
    });
  }

  test("withdrawing is one click, just like accepting", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.locator("#cookie-accept").click();
    expect((await consentCookie(context)).value).toBe("accepted");

    await page.locator("[data-consent-revoke]").first().click();

    expect(await consentCookie(context)).toBeUndefined();
    await expect(page.locator("#cookie-banner")).toBeVisible();
  });

  test("withdrawing on the privacy page asks again there", async ({
    page,
    context,
  }) => {
    await page.goto("/datenschutz.html");
    await page.locator("#cookie-accept").click();
    await expect(page.locator("#cookie-banner")).toBeHidden();

    await page.locator("[data-consent-revoke]").first().click();

    expect(await consentCookie(context)).toBeUndefined();
    await expect(page.locator("#cookie-banner")).toBeVisible();
  });

  test("nothing is tracked again after a withdrawal", async ({ page }) => {
    await page.goto("/");
    await page.locator("#cookie-accept").click();
    await page.locator("[data-consent-revoke]").first().click();

    const requests = await trackingRequests(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
  });
});
