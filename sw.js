const CACHE_NAME = "accounting-quest-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./ui-base.css",
  "./ui-pages.css",
  "./ui-case.css",
  "./ui-responsive.css",
  "./deep-1.css",
  "./deep-2.css",
  "./deep-3.css",
  "./deep-4.css",
  "./basics.css",
  "./case-schema.js",
  "./app-core.js",
  "./case-schema-bootstrap.js",
  "./basics-engine.js",
  "./basics-bootstrap.js",
  "./app-lessons.js",
  "./case-engine.js",
  "./app-actions.js",
  "./ui-foundation.js",
  "./ui-home.js",
  "./ui-cases.js",
  "./ui-learning.js",
  "./ui-records.js",
  "./ui-case-view.js",
  "./ui-case-steps.js",
  "./ui-case-nav.js",
  "./ui-live.js",
  "./deep-state.js",
  "./case-schema-state.js",
  "./basics-state.js",
  "./deep-calculator.js",
  "./deep-ui-shell.js",
  "./deep-ui-home-case.js",
  "./deep-ui-steps.js",
  "./deep-ui-records-layers.js",
  "./deep-actions.js",
  "./basics-ui.js",
  "./basics-actions.js",
  "./pwa.js",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./site.webmanifest",
  "./data/cases/index.json",
  "./data/skills/index.json",
  "./data/basics/index.json",
  "./data/cases/case-001-black-profit-no-cash.json",
  "./data/cases/case-002-sleeping-hit-products.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || network;
    })
  );
});
