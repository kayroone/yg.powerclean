import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const asset = (name) => resolve(root, "assets", name);

const RASTER_ICONS = [
  { source: "favicon.svg", target: "favicon-32.png", size: 32 },
  { source: "favicon.svg", target: "apple-touch-icon.png", size: 180 },
];

const OG_SIZE = { width: 1200, height: 630 };
const PORTRAIT = { source: "yoldas.png", width: 640 };
const PORTRAIT_VARIANTS = [
  { target: "yoldas-640.webp", type: "image/webp", quality: 0.82 },
  { target: "yoldas-640.jpg", type: "image/jpeg", quality: 0.86 },
];

async function renderIcons(browser) {
  for (const { source, target, size } of RASTER_ICONS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const svg = await readFile(asset(source), "utf-8");
    await page.setContent(
      `<!doctype html><meta charset="utf-8">
       <style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}
       svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: asset(target), type: "png" });
    await page.close();
    console.log(`${target} ${size}x${size}`);
  }
}

async function renderOgImage(browser) {
  const page = await browser.newPage({ viewport: OG_SIZE, deviceScaleFactor: 1 });
  await page.goto(`file://${resolve(here, "og-template.html")}`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: asset("og-image.png"), type: "png" });
  await page.close();
  console.log(`og-image.png ${OG_SIZE.width}x${OG_SIZE.height}`);
}

async function renderPortrait(browser) {
  const page = await browser.newPage();
  const source = await readFile(asset(PORTRAIT.source));
  const dataUrl = `data:image/png;base64,${source.toString("base64")}`;
  const encoded = await page.evaluate(
    ({ dataUrl, width, variants }) =>
      new Promise((done, fail) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = Math.round(
            (image.naturalHeight / image.naturalWidth) * width,
          );
          const context = canvas.getContext("2d");
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          done(
            variants.map(({ target, type, quality }) => ({
              target,
              type,
              url: canvas.toDataURL(type, quality),
            })),
          );
        };
        image.onerror = () => fail(new Error("portrait could not be decoded"));
        image.src = dataUrl;
      }),
    { dataUrl, width: PORTRAIT.width, variants: PORTRAIT_VARIANTS },
  );

  for (const { target, type, url } of encoded) {
    if (!url.startsWith(`data:${type}`)) {
      throw new Error(`browser did not produce ${type} output`);
    }
    const bytes = Buffer.from(url.split(",")[1], "base64");
    await writeFile(asset(target), bytes);
    console.log(`${target} ${PORTRAIT.width}px ${Math.round(bytes.length / 1024)} KB`);
  }

  await page.close();
}

const browser = await chromium.launch();
try {
  await renderIcons(browser);
  await renderOgImage(browser);
  await renderPortrait(browser);
} finally {
  await browser.close();
}
