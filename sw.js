// Soupline · réseau d'abord (toujours la dernière version), cache en secours
// pour les soirs sans réseau, à l'hôtel lors des déplacements.
// La 3D (three.js) vient d'un CDN à version figée : on la garde en cache dès le premier chargement.
var CACHE = "soupline-v3";
var COEUR = ["./", "index.html", "style.css", "figure.js", "figure3d.js", "programme.js", "app.js", "manifest.webmanifest",
  "icone-180.png", "icone-192.png", "icone-512.png"];
var CDN = ["https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/controls/OrbitControls.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(COEUR).then(function () { return c.addAll(CDN).catch(function () { /* au prochain passage */ }); });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (rep) {
        if (rep && rep.ok) { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copie); }); }
        return rep;
      });
    }));
    return;
  }
  // no-cache : on revalide chaque fichier auprès du serveur, pour ne jamais mélanger deux versions de l'app
  e.respondWith(fetch(e.request, url.origin === location.origin ? { cache: "no-cache" } : undefined).then(function (r) {
    if (r && r.ok && url.origin === location.origin) {
      var copie = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
    }
    return r;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || (e.request.mode === "navigate" ? caches.match("index.html") : undefined) || Response.error(); });
  }));
});
