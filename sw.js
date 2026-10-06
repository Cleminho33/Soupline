// Soupline · réseau d'abord (toujours la dernière version), cache en secours
// pour les soirs sans réseau, à l'hôtel lors des déplacements.
var CACHE = "soupline-v1";
var COEUR = ["./", "index.html", "style.css", "figure.js", "programme.js", "app.js", "manifest.webmanifest",
  "icone-180.png", "icone-192.png", "icone-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(COEUR); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r && r.ok && new URL(e.request.url).origin === location.origin) {
      var copie = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
    }
    return r;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); });
  }));
});
