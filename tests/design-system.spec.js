const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const FIXTURE = "/tests/fixtures/components.html";
const STYLESHEET = resolve(__dirname, "..", "css", "style.css");

// Tokens aus DESIGN-SYSTEM-YG-PowerClean.md, Abschnitt 1.1
const DESIGN_SYSTEM_TOKENS = [
  "--pc-navy-950",
  "--pc-navy-900",
  "--pc-navy-800",
  "--pc-navy-700",
  "--pc-blue-600",
  "--pc-blue-500",
  "--pc-blue-400",
  "--pc-blue-300",
  "--pc-cyan-500",
  "--pc-cyan-400",
  "--pc-text",
  "--pc-heading",
  "--pc-white",
  "--pc-muted",
  "--pc-panel",
  "--pc-panel-strong",
  "--pc-border",
  "--pc-border-subtle",
  "--pc-check",
  "--pc-sticker",
  "--pc-sticker-text",
  "--pc-radius-card",
  "--pc-radius-pill",
  "--pc-content-max",
];

function channelLuminance(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseColor(value) {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  }
  const parts = value.match(/-?\d*\.?\d+/g);
  if (!parts || parts.length < 3) {
    throw new Error(`unlesbare Farbe: ${value}`);
  }
  return parts.slice(0, 3).map(Number);
}

function relativeLuminance(value) {
  const [r, g, b] = parseColor(value);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

// Liest die Farbe, die hinter einem Element tatsaechlich gerendert wird: Text
// unsichtbar schalten, Screenshot, Pixel in der Mitte des Elements auslesen.
async function renderedBackground(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element hat keine Flaeche");

  const blanked = await page.addStyleTag({
    content: "*, *::before, *::after { color: transparent !important; }",
  });
  const shot = (await page.screenshot({ type: "png" })).toString("base64");
  await blanked.evaluate((node) => node.remove());

  return page.evaluate(
    ({ shot, x, y }) =>
      new Promise((done, fail) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const scale = image.width / window.innerWidth;
          const pixel = context.getImageData(
            Math.round(x * scale),
            Math.round(y * scale),
            1,
            1,
          ).data;
          done(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
        };
        image.onerror = () => fail(new Error("Screenshot nicht dekodierbar"));
        image.src = `data:image/png;base64,${shot}`;
      }),
    { shot, x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
}

function stylesheetWithoutTokenBlock() {
  const css = readFileSync(STYLESHEET, "utf-8");
  const start = css.indexOf(":root");
  const end = css.indexOf("}", start);
  return css.slice(0, start) + css.slice(end + 1);
}

test.describe("design tokens", () => {
  test("every token from the design system resolves on :root", async ({
    page,
  }) => {
    await page.goto(FIXTURE);
    const resolved = await page.evaluate((tokens) => {
      const styles = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        tokens.map((token) => [token, styles.getPropertyValue(token).trim()]),
      );
    }, DESIGN_SYSTEM_TOKENS);

    for (const token of DESIGN_SYSTEM_TOKENS) {
      expect(resolved[token], `${token} fehlt`).not.toBe("");
    }
  });

  test("no colour literal lives outside the token block", () => {
    const css = stylesheetWithoutTokenBlock();
    const hexLiterals = css.match(/#[0-9a-f]{3,8}\b/gi) || [];
    const functionLiterals = css.match(/\b(?:rgba?|hsla?)\s*\(/gi) || [];
    expect(hexLiterals, "Hex-Farben gehören in :root").toEqual([]);
    expect(functionLiterals, "rgb/hsl-Farben gehören in :root").toEqual([]);
  });
});

const CONTRAST_PROBES = [
  { name: "Fließtext auf Seitenhintergrund", selector: ".hero__copy", min: 4.5 },
  { name: "Überschrift auf Seitenhintergrund", selector: "h1", min: 3 },
  {
    name: "Sekundärtext auf Seitenhintergrund",
    selector: "#leistungen .pc-section-head p:not(.pc-kicker)",
    min: 4.5,
  },
  {
    name: "Kicker in Cyan auf Seitenhintergrund",
    selector: "#leistungen .pc-kicker",
    min: 4.5,
  },
  {
    name: "Fließtext auf Karte",
    selector: ".service-card .pc-check-list li",
    min: 4.5,
  },
  {
    name: "Häkchen auf Karte",
    selector: ".service-card .pc-check-list li",
    foregroundToken: "--pc-check",
    min: 3,
  },
  { name: "Text im Cookie-Banner", selector: "#cookie-banner-text", min: 4.5 },
];

test.describe("contrast", () => {
  test("every text probe reaches its minimum against what is behind it", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    for (const probe of CONTRAST_PROBES) {
      const locator = page.locator(probe.selector).first();
      const foreground = probe.foregroundToken
        ? await page.evaluate(
            (token) =>
              getComputedStyle(document.documentElement)
                .getPropertyValue(token)
                .trim(),
            probe.foregroundToken,
          )
        : await locator.evaluate((element) => getComputedStyle(element).color);
      const background = await renderedBackground(page, locator);
      const ratio = contrastRatio(foreground, background);

      expect
        .soft(
          ratio,
          `${probe.name}: ${foreground} auf ${background} = ${ratio.toFixed(2)}:1`,
        )
        .toBeGreaterThanOrEqual(probe.min);
    }
  });

  test("the sticker keeps its own pair readable", async ({ page }) => {
    await page.goto(FIXTURE);
    const [text, surface] = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return [
        styles.getPropertyValue("--pc-sticker-text").trim(),
        styles.getPropertyValue("--pc-sticker").trim(),
      ];
    });
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("colour literals", () => {
  const HTML_FILES = ["index.html", "impressum.html", "datenschutz.html"];

  for (const file of HTML_FILES) {
    test(`${file} carries no colour literal either`, () => {
      const html = readFileSync(resolve(__dirname, "..", file), "utf-8")
        // theme-color muss ein Literal sein, var() ist dort nicht erlaubt
        .replace(/<meta\s+name="theme-color"[^>]*>/gi, "");
      const hexLiterals = html.match(/#[0-9a-f]{3,8}\b/gi) || [];
      expect(
        hexLiterals,
        "Markenfarben gehören in Tokens, auch im Inline-SVG",
      ).toEqual([]);
    });
  }
});

test.describe("components", () => {
  test("keyboard focus produces a visible ring", async ({ page }) => {
    await page.goto(FIXTURE);
    for (const id of ["#button", "#button-secondary"]) {
      await page.locator(id).focus();
      const outline = await page.locator(id).evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          width: parseFloat(styles.outlineWidth),
          style: styles.outlineStyle,
          color: styles.outlineColor,
        };
      });
      expect(outline.width, `${id} ohne Fokusring`).toBeGreaterThanOrEqual(2);
      expect(outline.style).not.toBe("none");
      expect(outline.color).not.toBe("rgba(0, 0, 0, 0)");
    }
  });

  test("buttons meet the 44 by 44 pixel touch target", async ({ page }) => {
    await page.goto(FIXTURE);
    for (const id of ["#button", "#button-secondary"]) {
      const box = await page.locator(id).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("card uses the token radius and a visible border", async ({ page }) => {
    await page.goto(FIXTURE);
    const card = await page.locator("#card").evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        radius: styles.borderTopLeftRadius,
        borderWidth: parseFloat(styles.borderTopWidth),
        backgroundImage: styles.backgroundImage,
      };
    });
    expect(card.radius).toBe("20px");
    expect(card.borderWidth).toBeGreaterThan(0);
    expect(card.backgroundImage).toContain("gradient");
  });

  test("check list renders a marker for every item", async ({ page }) => {
    await page.goto(FIXTURE);
    const markers = await page.locator(".pc-check-list li").evaluateAll((items) =>
      items.map((item) => getComputedStyle(item, "::before").content),
    );
    expect(markers).toHaveLength(3);
    for (const marker of markers) {
      expect(marker).not.toBe("none");
      expect(marker.replace(/"/g, "")).not.toBe("");
    }
  });

  test("visually hidden content stays in the accessibility tree", async ({
    page,
  }) => {
    await page.goto(FIXTURE);
    const heading = page.locator("h1.visually-hidden");
    await expect(heading).toHaveText("Bausteine des Design-Systems");
    const box = await heading.boundingBox();
    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
  });
});

test.describe("motion and layout", () => {
  test("reduced motion switches off transitions and animations", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(FIXTURE);
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll("body *")].flatMap((element) => {
        const styles = getComputedStyle(element);
        return [styles.transitionDuration, styles.animationDuration];
      }),
    );
    for (const duration of durations) {
      expect(parseFloat(duration)).toBe(0);
    }
  });

  test("scroll animations are visible without javascript", async ({ page }) => {
    await page.goto(FIXTURE);
    await expect(page.locator("#card")).toBeVisible();
    const opacity = await page
      .locator("#card")
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(parseFloat(opacity)).toBeGreaterThan(0);
  });

  test("no horizontal overflow at 320 pixels", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(FIXTURE);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("body text stays readable at 320 pixels", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(FIXTURE);
    const fontSize = await page
      .locator(".pc-check-list li")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(18);
  });
});
