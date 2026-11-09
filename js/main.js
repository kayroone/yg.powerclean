document.documentElement.classList.add("js");

const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";
const META_PIXEL_ID = "000000000000000";
const CONSENT_COOKIE = "yg_cookie_consent";
const CONSENT_DAYS = 180;

function setupNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (!toggle || !nav) return;

  const setState = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
  };

  toggle.addEventListener("click", () => {
    setState(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setState(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    setState(false);
    toggle.focus();
  });
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

function writeCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

function clearCookie(name) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${secure}`;
}

function loadGoogleAnalytics() {
  if (GA_MEASUREMENT_ID.includes("XXXX")) return;
  if (document.getElementById("ga-script")) return;

  const script = document.createElement("script");
  script.id = "ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.addEventListener("load", () => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID);
  });
  document.head.appendChild(script);
}

function loadMetaPixel() {
  if (/^0+$/.test(META_PIXEL_ID)) return;
  if (window.fbq) return;

  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("init", META_PIXEL_ID);
  window.fbq("track", "PageView");
}

function loadTrackingScripts() {
  loadGoogleAnalytics();
  loadMetaPixel();
}

function setupCookieBanner() {
  const decision = readCookie(CONSENT_COOKIE);
  if (decision === "accepted") {
    loadTrackingScripts();
    return;
  }

  const banner = document.getElementById("cookie-banner");
  if (!banner || decision === "declined") return;

  const reserveSpace = () => {
    document.body.style.paddingBottom = banner.hidden
      ? ""
      : `${banner.offsetHeight}px`;
  };

  banner.hidden = false;
  reserveSpace();
  window.addEventListener("resize", reserveSpace);

  const decide = (value) => {
    writeCookie(CONSENT_COOKIE, value, CONSENT_DAYS);
    banner.hidden = true;
    reserveSpace();
    if (value === "accepted") loadTrackingScripts();
  };

  document
    .getElementById("cookie-accept")
    .addEventListener("click", () => decide("accepted"));
  document
    .getElementById("cookie-decline")
    .addEventListener("click", () => decide("declined"));
}

function setupConsentRevoke() {
  document.querySelectorAll("[data-consent-revoke]").forEach((control) => {
    control.addEventListener("click", () => {
      clearCookie(CONSENT_COOKIE);
      location.reload();
    });
  });
}

function setupScrollAnimations() {
  const targets = document.querySelectorAll(".animate-on-scroll");
  if (targets.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0, rootMargin: "0px 0px -10% 0px" },
  );

  targets.forEach((target) => observer.observe(target));
}

function setupBrandFlip() {
  const mark = document.querySelector(".brand__mark");
  const brand = mark && mark.closest(".brand");
  if (!brand) return;

  const flip = () => mark.classList.add("is-flipping");
  const reset = () => mark.classList.remove("is-flipping");

  mark.addEventListener("animationend", reset);
  mark.addEventListener("animationcancel", reset);
  brand.addEventListener("pointerenter", flip);
  brand.addEventListener("click", flip);
}

setupNavigation();
setupBrandFlip();
setupCookieBanner();
setupConsentRevoke();
setupScrollAnimations();

function setupCurrentYear() {
  const target = document.getElementById("current-year");
  if (!target) return;
  target.textContent = String(new Date().getFullYear());
}

setupCurrentYear();
