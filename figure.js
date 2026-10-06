// Soupline · le bonhomme, ses positions et son décor.
// Repère du dessin : 360 × 260. Vue de face : chevilles à y = 228, sol à y = 236.
// D et G désignent le côté du bonhomme, jamais celui de l'écran : la gêne de l'adducteur
// gauche reste du bon côté quelle que soit la vue (face, dos, dessus, contre le mur).
var FIG = (function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var L = { torse: 68, cou: 7, tete: 13.5, hanche: 13, epaule: 23, cuisse: 56, tibia: 54, bras: 41, avantBras: 39, pied: 15 };
  var JAMBE = L.cuisse + L.tibia;
  var EP = { cuisse: 20.5, tibia: 16, bras: 13, avantBras: 11, pied: 8.5, cou: 10, main: 6 };
  var COUL = { corps: "#EEF2FB", loin: "#A9B4D2", zone: "#FFB547", effort: "#FF7A6B", calme: "#5EE0C8" };
  var SOL = 228, X0 = 180;
  var ORDRE = ["jD", "jG", "torse", "tete", "bD", "bG"];
  var uid = 0;

  // ---------- Outils ----------
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function pt(x, y) { return { x: x, y: y }; }
  function add(a, b) { return pt(a.x + b.x, a.y + b.y); }
  function sub(a, b) { return pt(a.x - b.x, a.y - b.y); }
  function mul(a, k) { return pt(a.x * k, a.y * k); }
  function lon(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function rad(d) { return d * Math.PI / 180; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function douce(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function vers(a, b, t) { return pt(mix(a.x, b.x, t), mix(a.y, b.y, t)); }
  function f1(n) { return Math.round(n * 10) / 10; }

  // Mélange de deux réglages (nombres, objets imbriqués) ; le reste bascule à mi-chemin
  function melange(a, b, t) {
    if (typeof a === "number" && typeof b === "number") return mix(a, b, t);
    if (a && b && typeof a === "object" && typeof b === "object") {
      var o = Array.isArray(a) ? [] : {}, k;
      for (k in a) o[k] = (k in b) ? melange(a[k], b[k], t) : a[k];
      for (k in b) if (!(k in a)) o[k] = b[k];
      return o;
    }
    return t < 0.5 ? a : b;
  }

  // Membre à deux segments : l'articulation se calcule, pliée du côté demandé
  function ik(a, cible, l1, l2, plie) {
    var d = sub(cible, a), dist = lon(d) || 0.001;
    var max = l1 + l2 - 0.01, min = Math.abs(l1 - l2) + 0.01;
    if (dist > max) { cible = add(a, mul(d, max / dist)); dist = max; }
    else if (dist < min) { cible = add(a, mul(d, min / dist)); dist = min; }
    var u = mul(sub(cible, a), 1 / dist);
    var le = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    var h = Math.sqrt(Math.max(0, l1 * l1 - le * le));
    var n = pt(-u.y, u.x);
    return { m: add(add(a, mul(u, le)), mul(n, h * (plie < 0 ? -1 : 1))), b: cible };
  }

  // ---------- Squelette ----------
  // torse : angle en degrés (0 = tête en haut de l'écran, positif = sens horaire).
  // face : 1 si le bonhomme nous regarde (sa droite à gauche de l'écran), -1 s'il nous tourne le dos.
  function squelette(p) {
    var face = p.face || 1, s = p.souffle || 0;
    var a = rad(p.torse || 0);
    var u = pt(Math.sin(a), -Math.cos(a)), q = pt(Math.cos(a), Math.sin(a));
    var tl = p.torseL == null ? 1 : p.torseL;
    var B = pt(p.bassin.x, p.bassin.y);
    var cou = add(B, mul(u, L.torse * tl * (1 + s * 0.03)));
    var hs = L.hanche * (p.hancheS == null ? 1 : p.hancheS);
    var es = L.epaule * (p.epauleS == null ? 1 : p.epauleS) * (1 + s * 0.025);
    var hD = add(B, mul(q, -hs * face)), hG = add(B, mul(q, hs * face));
    var baisse = mul(u, -5 * tl + 1.5 * s);
    var eD = add(add(cou, mul(q, -es * face)), baisse), eG = add(add(cou, mul(q, es * face)), baisse);
    var ts = p.teteS == null ? 1 : p.teteS;
    var ta = a + rad(p.teteA || 0), tu = pt(Math.sin(ta), -Math.cos(ta));
    var tr = L.tete * ts;
    var tete = add(cou, mul(tu, (L.cou * ts + tr * 0.92) * (p.teteD == null ? 1 : p.teteD)));
    return {
      B: B, u: u, q: q, cou: cou, tete: tete, tr: tr, ts: ts, es: es, hs: hs, face: face,
      hD: hD, hG: hG, eD: eD, eG: eG,
      jD: jambe(hD, p.jD || {}), jG: jambe(hG, p.jG || {}),
      bD: bras(eD, p.bD || {}), bG: bras(eG, p.bG || {})
    };
  }
  function jambe(h, j) {
    var l1 = L.cuisse * (j.s1 == null ? 1 : j.s1), l2 = L.tibia * (j.s2 == null ? 1 : j.s2);
    var b = pt(j.x == null ? h.x : j.x, j.y == null ? SOL : j.y);
    var r = j.m ? { m: pt(j.m.x, j.m.y), b: b } : ik(h, b, l1, l2, j.plie || 1);
    var pa = rad(j.pied == null ? 90 : j.pied), pl = L.pied * (j.piedL == null ? 1 : j.piedL);
    return { h: h, m: r.m, b: r.b, bout: add(r.b, pt(Math.cos(pa) * pl, Math.sin(pa) * pl)) };
  }
  function bras(e, b) {
    var l1 = L.bras * (b.s1 == null ? 1 : b.s1), l2 = L.avantBras * (b.s2 == null ? 1 : b.s2);
    var cible = pt(b.x == null ? e.x : b.x, b.y == null ? e.y + l1 + l2 : b.y);
    var r = b.m ? { m: pt(b.m.x, b.m.y), b: cible } : ik(e, cible, l1, l2, b.plie || 1);
    return { h: e, m: r.m, b: r.b };
  }

  // Une pose vue dans un miroir : on retourne l'écran et on échange droite et gauche
  function miroir(p) {
    var m = JSON.parse(JSON.stringify(p));
    function mx(o) { if (o && typeof o.x === "number") o.x = 360 - o.x; }
    function dg(k) { return k.replace(/D$/, "#").replace(/G$/, "D").replace(/#$/, "G"); }
    mx(m.bassin);
    m.torse = -(m.torse || 0);
    if (m.teteA) m.teteA = -m.teteA;
    ["jD", "jG", "bD", "bG"].forEach(function (k) {
      var j = m[k]; if (!j) return;
      mx(j); if (j.m) mx(j.m);
      if (j.pied != null) j.pied = 180 - j.pied;
      if (j.plie) j.plie = -j.plie;
    });
    var t = m.jD; m.jD = m.jG; m.jG = t;
    t = m.bD; m.bD = m.bG; m.bG = t;
    (m.props || []).forEach(function (q) {
      if (typeof q.x === "number") q.x = 360 - q.x;
      if (q.x1 != null) { var a = 360 - q.x2, b = 360 - q.x1; q.x1 = a; q.x2 = b; }
    });
    (m.fleches || []).forEach(function (f) { f.x = 360 - f.x; f.a = 180 - f.a; });
    (m.zones || []).forEach(function (z) { z.ou = z.ou === "addD" ? "addG" : z.ou === "addG" ? "addD" : z.ou; });
    if (m.ordre) m.ordre = m.ordre.map(dg);
    if (m.loin) m.loin = m.loin.map(dg);
    return m;
  }

  // ---------- Décors (fixes) ----------
  function decor(cle, id) {
    var mur = '<defs><linearGradient id="' + id + 'm" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#10172E"/><stop offset="1" stop-color="#1A2446"/></linearGradient>' +
      '<linearGradient id="' + id + 's" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#1B2443"/><stop offset="1" stop-color="#1B2443" stop-opacity="0"/></linearGradient></defs>';
    switch (cle) {
      case "sol":
        return mur + '<rect x="0" y="236" width="360" height="26" fill="url(#' + id + 's)"/>' +
          '<line x1="16" y1="236" x2="344" y2="236" stroke="#2C375E" stroke-width="2" stroke-linecap="round"/>';
      case "tapis":
        return '<rect x="96" y="8" width="168" height="236" rx="22" fill="#17203C" stroke="#25305A" stroke-width="2"/>' +
          '<path d="M118 20 V232 M242 20 V232" stroke="#1D2849" stroke-width="2"/>';
      case "tapisL":
        return '<rect x="28" y="10" width="304" height="232" rx="24" fill="#17203C" stroke="#25305A" stroke-width="2"/>' +
          '<path d="M52 22 V230 M308 22 V230" stroke="#1D2849" stroke-width="2"/>';
      case "mur":
        return mur + '<rect x="0" y="0" width="360" height="170" fill="url(#' + id + 'm)"/>' +
          '<rect x="0" y="165" width="360" height="6" fill="#28335D"/>' +
          '<rect x="0" y="171" width="360" height="90" fill="#0D1328"/>' +
          '<path d="M134 171 H226 L266 260 H94 Z" fill="#18213F"/>';
      case "murFond":
        return mur + '<rect x="0" y="0" width="360" height="204" fill="url(#' + id + 'm)"/>' +
          '<rect x="0" y="199" width="360" height="6" fill="#28335D"/>' +
          '<rect x="0" y="205" width="360" height="56" fill="#0D1328"/>' +
          '<rect x="96" y="70" width="168" height="7" rx="3.5" fill="#3A4778"/>' +
          '<rect x="104" y="77" width="5" height="12" fill="#2C3760"/><rect x="251" y="77" width="5" height="12" fill="#2C3760"/>';
      case "solDos":
        return '<path d="M0 178 H360 V262 H0 Z" fill="#0E1530"/>' +
          '<path d="M78 182 H282 L334 254 H26 Z" fill="#17203C" stroke="#25305A" stroke-width="2" stroke-linejoin="round"/>' +
          '<path d="M104 182 L70 254 M256 182 L290 254" stroke="#1D2849" stroke-width="2"/>';
    }
    return "";
  }

  // ---------- Accessoires (suivent la pose) ----------
  var DEVANT = { appui: 1, chaise: 1, coussin: 1 };
  function accessoire(p) {
    var x = f1(p.x || 0), y = f1(p.y || 0);
    switch (p.t) {
      case "appui": {
        var h = f1(Math.max(8, 252 - p.y));
        return '<rect x="' + f1(p.x - 15) + '" y="' + y + '" width="30" height="' + h + '" rx="6" fill="#2B375F"/>' +
          '<rect x="' + f1(p.x - 15) + '" y="' + y + '" width="30" height="7" rx="3.5" fill="#43528C"/>';
      }
      case "chaise":
        return '<path d="M126 ' + y + ' H234 M136 ' + y + ' V252 M224 ' + y + ' V252" stroke="#5A6799" stroke-width="5" stroke-linecap="round" fill="none" opacity=".85"/>';
      case "serviette":
        return '<rect x="' + f1(p.x - 19) + '" y="231" width="38" height="8" rx="4" fill="#3C8C86" opacity=".9"/>';
      case "banc": {
        var w = f1(p.x2 - p.x1);
        return '<rect x="' + f1(p.x1 + 8) + '" y="' + f1(p.y + 8) + '" width="8" height="' + f1(236 - p.y - 8) + '" rx="2" fill="#222C50"/>' +
          '<rect x="' + f1(p.x2 - 16) + '" y="' + f1(p.y + 8) + '" width="8" height="' + f1(236 - p.y - 8) + '" rx="2" fill="#222C50"/>' +
          '<rect x="' + f1(p.x1) + '" y="' + y + '" width="' + w + '" height="11" rx="4" fill="#33406C"/>';
      }
      case "coussin":
        return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + f1(p.rx) + '" ry="' + f1(p.ry) + '" fill="#8C7BFF"/>' +
          '<ellipse cx="' + x + '" cy="' + f1(p.y - p.ry * 0.35) + '" rx="' + f1(p.rx * 0.55) + '" ry="' + f1(p.ry * 0.3) + '" fill="#B3A8FF" opacity=".7"/>';
      case "genouillere":
        return '<ellipse cx="' + x + '" cy="' + y + '" rx="17" ry="12" fill="#2B375F"/>';
      case "assise":
        return '<ellipse cx="' + x + '" cy="' + y + '" rx="34" ry="18" fill="#2B375F"/>';
      case "onde": {
        var o = clamp(p.f, 0, 1).toFixed(2);
        return '<circle cx="' + x + '" cy="' + y + '" r="' + f1(9 + 5 * p.f) + '" fill="none" stroke="#FF7A6B" stroke-width="2.5" opacity="' + o + '"/>' +
          '<circle cx="' + x + '" cy="' + y + '" r="' + f1(16 + 7 * p.f) + '" fill="none" stroke="#FF7A6B" stroke-width="1.5" opacity="' + (o * 0.5).toFixed(2) + '"/>';
      }
    }
    return "";
  }
  function fleche(f) {
    return '<g transform="translate(' + f1(f.x) + ' ' + f1(f.y) + ') rotate(' + f1(f.a) + ')" opacity="' + clamp(f.f, 0, 1).toFixed(2) + '">' +
      '<path d="M-10 -6 L-4 0 L-10 6 M-2 -6 L4 0 L-2 6" stroke="#FF7A6B" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
  }

  // ---------- Zones qui s'allument ----------
  function zoneD(sk, ou) {
    if (ou === "addD" || ou === "addG") {
      var j = ou === "addD" ? sk.jD : sk.jG, autre = ou === "addD" ? sk.hG : sk.hD;
      var v = sub(j.m, j.h), l = lon(v);
      if (l < 4) return "";
      var n = pt(-v.y / l, v.x / l), w = sub(autre, j.h), dot = n.x * w.x + n.y * w.y;
      var off = Math.abs(dot) < lon(w) * 0.3 ? 0 : 5;
      if (dot < 0) n = mul(n, -1);
      var a = add(add(j.h, mul(v, 0.14)), mul(n, off)), b = add(add(j.h, mul(v, 0.84)), mul(n, off * 0.8));
      return "M" + f1(a.x) + " " + f1(a.y) + " L" + f1(b.x) + " " + f1(b.y);
    }
    if (ou === "poitrine") {
      var c = vers(sk.B, sk.cou, 0.68), r = 10;
      return "M" + f1(c.x - r) + " " + f1(c.y) + " a" + r + " " + r + " 0 1 0 " + 2 * r + " 0 a" + r + " " + r + " 0 1 0 " + -2 * r + " 0";
    }
    return "";
  }

  // ---------- La scène ----------
  function Scene(svg) {
    this.svg = svg;
    this.id = "rl" + (++uid);
    svg.setAttribute("viewBox", "0 0 360 260");
    var defs = el("defs", {}, svg);
    var f = el("filter", { id: this.id + "f", x: "-80%", y: "-80%", width: "260%", height: "260%" }, defs);
    el("feGaussianBlur", { stdDeviation: "3.4" }, f);
    this.gDecor = el("g", {}, svg);
    this.gArriere = el("g", {}, svg);
    this.gCorps = el("g", { "stroke-linecap": "round" }, svg);
    this.gZones = el("g", { filter: "url(#" + this.id + "f)" }, svg);
    this.gZonesNet = el("g", {}, svg);
    this.gDevant = el("g", {}, svg);
    this.gFleches = el("g", {}, svg);
    this.zonesEl = [];
    this.cache = { decor: null, ordre: "", arriere: "", devant: "", fleches: "" };
    var P = this.p = {}, g = this.gCorps;
    function membre(e1, e2, e3, main) {
      var gg = el("g", {}, g);
      return {
        g: gg,
        a: el("line", { "stroke-width": e1 }, gg),
        b: el("line", { "stroke-width": e2 }, gg),
        c: main ? el("circle", { r: e3, stroke: "none" }, gg) : el("line", { "stroke-width": e3 }, gg),
        genou: main ? null : el("circle", { r: 0, stroke: "none" }, gg)
      };
    }
    P.jD = membre(EP.cuisse, EP.tibia, EP.pied, false);
    P.jG = membre(EP.cuisse, EP.tibia, EP.pied, false);
    P.torse = { g: el("g", {}, g) };
    P.torse.p = el("path", { "stroke-width": 9, "stroke-linejoin": "round" }, P.torse.g);
    P.tete = { g: el("g", {}, g) };
    P.tete.cou = el("line", { "stroke-width": EP.cou }, P.tete.g);
    P.tete.c = el("circle", { stroke: "none" }, P.tete.g);
    P.bD = membre(EP.bras, EP.avantBras, EP.main, true);
    P.bG = membre(EP.bras, EP.avantBras, EP.main, true);
    for (var k in P) this._couleur(k, COUL.corps);
  }
  Scene.prototype._couleur = function (k, c) {
    var part = this.p[k];
    if (part.coul === c) return;
    part.coul = c;
    part.g.setAttribute("stroke", c);
    part.g.setAttribute("fill", c);
  };
  Scene.prototype.dessiner = function (pose) {
    var sk = squelette(pose), P = this.p, self = this, i;
    var cle = pose.decor || "";
    if (cle !== this.cache.decor) { this.gDecor.innerHTML = decor(cle, this.id); this.cache.decor = cle; }
    // Cadrage serré quand la position laisse du vide (assis, allongé) : le bonhomme gagne en taille
    var cadre = (pose.cadre || [0, 0, 360, 260]).join(" ");
    if (cadre !== this.cache.cadre) { this.svg.setAttribute("viewBox", cadre); this.cache.cadre = cadre; }
    var ordre = pose.ordre || ORDRE, oc = ordre.join(",");
    if (oc !== this.cache.ordre) {
      ordre.forEach(function (k) { self.gCorps.appendChild(P[k].g); });
      this.cache.ordre = oc;
    }
    var loin = pose.loin || [];
    for (var k in P) this._couleur(k, loin.indexOf(k) >= 0 ? COUL.loin : COUL.corps);

    function seg(n, a, b) {
      n.setAttribute("x1", f1(a.x)); n.setAttribute("y1", f1(a.y));
      n.setAttribute("x2", f1(b.x)); n.setAttribute("y2", f1(b.y));
    }
    var rg = pose.genoux ? EP.cuisse * 0.5 * pose.genoux : 0;
    ["jD", "jG"].forEach(function (k) {
      var j = sk[k], m = P[k];
      seg(m.a, j.h, j.m); seg(m.b, j.m, j.b); seg(m.c, j.b, j.bout);
      m.genou.setAttribute("cx", f1(j.m.x)); m.genou.setAttribute("cy", f1(j.m.y)); m.genou.setAttribute("r", f1(rg));
    });
    ["bD", "bG"].forEach(function (k) {
      var j = sk[k], m = P[k];
      seg(m.a, j.h, j.m); seg(m.b, j.m, j.b);
      m.c.setAttribute("cx", f1(j.b.x)); m.c.setAttribute("cy", f1(j.b.y));
    });
    // Torse : épaules, taille, bassin, arrondis par le trait
    var qd = mul(sk.q, -sk.face), qg = mul(sk.q, sk.face);
    var taille = vers(sk.cou, sk.B, 0.56);
    var pts = [sk.eD, add(taille, mul(qd, sk.es * 0.72)), add(sk.B, mul(qd, sk.hs + 4)),
      add(sk.B, mul(qg, sk.hs + 4)), add(taille, mul(qg, sk.es * 0.72)), sk.eG];
    P.torse.p.setAttribute("d", pts.map(function (p, n) { return (n ? "L" : "M") + f1(p.x) + " " + f1(p.y); }).join(" ") + " Z");
    seg(P.tete.cou, sk.cou, sk.tete);
    P.tete.cou.setAttribute("stroke-width", f1(EP.cou * sk.ts));
    P.tete.c.setAttribute("cx", f1(sk.tete.x)); P.tete.c.setAttribute("cy", f1(sk.tete.y)); P.tete.c.setAttribute("r", f1(sk.tr));

    // Zones
    var zs = pose.zones || [];
    while (this.zonesEl.length < zs.length) {
      this.zonesEl.push([
        el("path", { fill: "none", "stroke-linecap": "round", "stroke-width": 12 }, this.gZones),
        el("path", { fill: "none", "stroke-linecap": "round", "stroke-width": 3.5 }, this.gZonesNet)
      ]);
    }
    for (i = 0; i < this.zonesEl.length; i++) {
      var z = zs[i], ze = this.zonesEl[i];
      if (!z) { ze[0].setAttribute("d", ""); ze[1].setAttribute("d", ""); continue; }
      var d = zoneD(sk, z.ou), c = COUL[z.c || "zone"], f = clamp(z.f, 0, 1);
      ze[0].setAttribute("d", d); ze[0].setAttribute("stroke", c); ze[0].setAttribute("opacity", f.toFixed(2));
      ze[1].setAttribute("d", d); ze[1].setAttribute("stroke", c); ze[1].setAttribute("opacity", (f * 0.9).toFixed(2));
    }
    // Accessoires et flèches d'effort
    var arr = "", dev = "";
    (pose.props || []).forEach(function (pr) {
      var m = accessoire(pr);
      if (pr.devant != null ? pr.devant : DEVANT[pr.t]) dev += m; else arr += m;
    });
    if (arr !== this.cache.arriere) { this.gArriere.innerHTML = arr; this.cache.arriere = arr; }
    if (dev !== this.cache.devant) { this.gDevant.innerHTML = dev; this.cache.devant = dev; }
    var fl = (pose.fleches || []).map(fleche).join("");
    if (fl !== this.cache.fleches) { this.gFleches.innerHTML = fl; this.cache.fleches = fl; }
    return sk;
  };

  // ---------- Les positions ----------
  // Chaque position reçoit ses réglages (o) et le souffle (s, de 0 à 1 : poumons vides → pleins).
  var POSES = {};
  function zone(ou, f, c) { return { ou: ou, f: clamp(f, 0, 1), c: c || "zone" }; }

  // Grand écart debout, de face. o : { angle } ou { v, a0, a1 }, c (contraction), bras : "appui" | "etoile"
  POSES.ecart = function (o, s) {
    s = s || 0;
    var ang = o.a0 != null ? mix(o.a0, o.a1, o.v || 0) : (o.angle == null ? 80 : o.angle);
    ang = clamp(ang + (o.bras === "etoile" ? 0 : (1 - s) * 1.5), 24, 178);
    var th = rad(ang / 2), by = SOL - JAMBE * Math.cos(th), dx = L.hanche + JAMBE * Math.sin(th);
    var B = pt(X0, by), c = o.c || 0, etoile = o.bras === "etoile", tl = etoile ? 1 : 0.8;
    var p = {
      face: 1, bassin: B, torse: 0, torseL: tl, teteS: etoile ? 1 : 1.05, souffle: s, decor: o.decor == null ? "sol" : o.decor,
      jD: { x: X0 - dx, y: SOL, pied: 118, piedL: 0.5 }, jG: { x: X0 + dx, y: SOL, pied: 62, piedL: 0.5 },
      zones: [], fleches: [], props: [], angle: ang
    };
    var epY = by - L.torse * tl + 5;
    if (etoile) {
      p.bD = { x: X0 - 104, y: epY - 26, plie: -1 }; p.bG = { x: X0 + 104, y: epY - 26, plie: 1 };
    } else {
      var hy = by + 30;
      p.bD = { x: X0 - 30, y: hy, plie: 1 }; p.bG = { x: X0 + 30, y: hy, plie: -1 };
      p.props.push({ t: "appui", x: X0 - 30, y: hy + 5 }, { t: "appui", x: X0 + 30, y: hy + 5 });
    }
    var coul = c > 0.05 ? "effort" : "zone", f = 0.3 + 0.55 * c + 0.15 * (1 - s);
    if (!etoile || o.zones) p.zones.push(zone("addD", f, coul), zone("addG", f, coul));
    if (c > 0.05) p.fleches.push({ x: X0 - dx + 22, y: SOL - 3, a: 0, f: c }, { x: X0 + dx - 22, y: SOL - 3, a: 180, f: c });
    return p;
  };

  // Fente cosaque, de face. o.v de -1 (en bas sur la jambe droite) à +1 (sur la gauche), o.prof
  POSES.cosaque = function (o, s) {
    var v = o.v || 0, k = Math.abs(v), cote = v < 0 ? -1 : 1;
    var FD = 102.7, FG = 257.3;
    var B = vers(pt(X0, 138.8), cote < 0 ? pt(139.7, 194) : pt(220.3, 194), k);
    var sD = cote < 0 ? mix(1, 0.86, k) : 1, sG = cote > 0 ? mix(1, 0.86, k) : 1;
    var p = {
      face: 1, bassin: B, torse: 0, torseL: mix(1, 0.93, k), souffle: s || 0, decor: "sol", cadre: [0, 18, 360, 242], props: [], fleches: [], zones: [],
      jD: { x: FD, y: SOL, plie: 1, s1: sD, s2: sD, pied: cote > 0 ? mix(158, 250, k) : 158, piedL: 0.75 },
      jG: { x: FG, y: SOL, plie: -1, s1: sG, s2: sG, pied: cote < 0 ? mix(22, -70, k) : 22, piedL: 0.75 },
      bD: { x: B.x - 5, y: B.y - 34, plie: 1 }, bG: { x: B.x + 5, y: B.y - 34, plie: -1 }
    };
    p.zones.push(zone(cote < 0 ? "addG" : "addD", k * (0.65 + 0.25 * (1 - (s || 0)))));
    return p;
  };

  // Cavalier, de face. o.v profondeur de 0 à 1
  POSES.cavalier = function (o, s) {
    var k = o.v || 0, B = pt(X0, mix(142, 178, k)), sc = mix(1, 0.9, k);
    return {
      face: 1, bassin: B, torse: 0, souffle: s || 0, decor: "sol", cadre: [0, 40, 360, 220], props: [], fleches: [],
      jD: { x: X0 - 62, y: SOL, plie: 1, s1: sc, s2: sc, pied: 140, piedL: 0.8 },
      jG: { x: X0 + 62, y: SOL, plie: -1, s1: sc, s2: sc, pied: 40, piedL: 0.8 },
      bD: { x: X0 - 5, y: B.y - 36, plie: 1 }, bG: { x: X0 + 5, y: B.y - 36, plie: -1 },
      zones: [zone("addD", 0.2 + 0.4 * k, o.effort ? "effort" : "zone"), zone("addG", 0.2 + 0.4 * k, o.effort ? "effort" : "zone")]
    };
  };

  // Glissade en écart, de face, mains sur le dossier d'une chaise. o : { v, cote, tire }
  POSES.glissade = function (o, s) {
    var k = o.v || 0;
    var B = vers(pt(X0, 118), pt(172, 168), k);
    var hipG = pt(B.x + L.hanche, B.y), dy = SOL - B.y;
    var fx = hipG.x + Math.sqrt(Math.max(0, JAMBE * JAMBE * 0.995 - dy * dy));
    var tire = o.tire || 0, sp = mix(1, 0.62, k);
    var p = {
      face: 1, bassin: B, torse: 0, torseL: mix(1, 0.92, k), souffle: s || 0, decor: "sol",
      jD: { x: 164, y: SOL, plie: 1, s1: sp, s2: sp, pied: 120, piedL: 0.6 },
      jG: { x: fx, y: SOL, plie: -1, pied: 60, piedL: 0.6 },
      bD: { x: 158, y: 128, plie: 1 }, bG: { x: 202, y: 128, plie: -1 },
      props: [{ t: "serviette", x: 164 }, { t: "serviette", x: fx }, { t: "chaise", y: 128 }],
      zones: [zone("addG", k * 0.85, tire > 0.5 ? "effort" : "zone")],
      fleches: tire > 0.5 && k > 0.05 ? [{ x: fx - 24, y: SOL - 4, a: 180, f: Math.min(1, k * 2) }] : []
    };
    return o.cote === "D" ? miroir(p) : p;
  };

  // Copenhague, allongé sur le côté, la jambe du dessus sur un banc. o : { v, cote (jambe du dessus), long }
  POSES.copenhague = function (o, s) {
    var k = o.v || 0;
    var S = pt(96, 186), E = pt(96, 228);
    var a = mix(-58, -97, k), ar = rad(a);
    var u = pt(Math.sin(ar), -Math.cos(ar)), q = pt(Math.cos(ar), Math.sin(ar));
    var B = sub(S, add(mul(u, L.torse - 5), mul(q, -L.epaule)));
    var hG = add(B, mul(q, L.hanche)), hD = add(B, mul(q, -L.hanche));
    var plY = 158, gY = plY - 9;
    var p = {
      face: 1, bassin: B, torse: a, souffle: s || 0, decor: "sol", cadre: [12, 92, 336, 168], props: [], fleches: [], zones: [],
      ordre: ["bD", "jD", "torse", "tete", "jG", "bG"], loin: ["bD", "jD"]
    };
    if (o.long) {
      var dyl = gY + 3 - hG.y, ch = pt(hG.x + Math.sqrt(Math.max(1, JAMBE * JAMBE * 0.99 - dyl * dyl)), gY + 3);
      p.jG = { x: ch.x, y: ch.y, plie: 1, pied: -12, piedL: 0.7 };
      p.props.push({ t: "banc", x1: ch.x - 22, x2: ch.x + 62, y: plY });
    } else {
      var dy = gY - hG.y, genou = pt(hG.x + Math.sqrt(Math.max(1, L.cuisse * L.cuisse - dy * dy)), gY);
      p.jG = { m: genou, x: genou.x + L.tibia, y: gY, pied: -8, piedL: 0.7 };
      p.props.push({ t: "banc", x1: genou.x - 14, x2: genou.x + 92, y: plY });
    }
    var dyd = SOL - hD.y, lj = JAMBE * 0.96;
    p.jD = { x: hD.x + Math.sqrt(Math.max(1, lj * lj - dyd * dyd)), y: SOL, plie: -1, pied: 0, piedL: 0.6 };
    p.bD = { m: E, x: 84, y: 233 };
    p.bG = { x: hG.x + 4, y: hG.y - 6, plie: -1 };
    p.zones.push(zone("addG", 0.3 + 0.6 * k, k > 0.5 ? "effort" : "zone"));
    return o.cote === "D" ? miroir(p) : p;
  };

  // Coussin serré entre les genoux, allongé, vu du dessus. o.c de 0 (relâché) à 1 (serré)
  POSES.squeeze = function (o, s) {
    var k = o.c || 0, B = pt(X0, 136), gx = mix(19, 9, k);
    var r = o.doux ? 0.5 : 1;
    return {
      face: 1, bassin: B, torse: 0, souffle: s || 0, decor: "tapis", cadre: [56, 0, 248, 252], genoux: 1.25,
      jD: { m: pt(X0 - gx, 167), x: X0 - 15, y: 197, pied: 90, piedL: 0.75 },
      jG: { m: pt(X0 + gx, 167), x: X0 + 15, y: 197, pied: 90, piedL: 0.75 },
      bD: { x: X0 - 42, y: 144, plie: 1 }, bG: { x: X0 + 42, y: 144, plie: -1 },
      props: [{ t: "coussin", x: X0, y: 167, rx: Math.max(6, gx - 6), ry: 10 + 4 * k }],
      zones: [zone("addD", (0.15 + 0.7 * k) * r, "effort"), zone("addG", (0.15 + 0.7 * k) * r, "effort")],
      fleches: k > 0.05 ? [{ x: X0 - gx - 20, y: 167, a: 0, f: k }, { x: X0 + gx + 20, y: 167, a: 180, f: k }] : []
    };
  };

  // Papillon allongé, vu du dessus. o.v ouverture des genoux de 0 à 1
  POSES.papillonAllonge = function (o, s) {
    var k = o.v || 0, B = pt(X0, 128);
    function genou(sg) { return pt(X0 + sg * mix(17, 60, k), mix(163, 166, k)); }
    return {
      face: 1, bassin: B, torse: 0, souffle: s || 0, decor: "tapis", cadre: [56, 0, 248, 252], genoux: mix(1.25, 1, k),
      jD: { m: genou(-1), x: X0 - 6, y: 192, pied: 0, piedL: 0.55 },
      jG: { m: genou(1), x: X0 + 6, y: 192, pied: 180, piedL: 0.55 },
      bD: { x: X0 - 10, y: 103, plie: 1 }, bG: { x: X0 + 10, y: 103, plie: -1 },
      props: [], fleches: [],
      zones: [zone("addD", 0.2 + 0.45 * k), zone("addG", 0.2 + 0.45 * k), zone("poitrine", 0.1 + 0.35 * (s || 0), "calme")]
    };
  };

  // Jambes au mur en V : vu depuis la tête, le mur au fond. o.angle ouverture des jambes
  POSES.murV = function (o, s) {
    s = s || 0;
    var ang = clamp((o.angle || 80) + (1 - s) * 2, 10, 176);
    var th = rad(ang / 2), B = pt(X0, 168);
    var fx = L.hanche + JAMBE * Math.sin(th), fy = B.y - JAMBE * Math.cos(th);
    var f = ang < 45 ? 0.1 : 0.28 + 0.22 * (1 - s);
    return {
      face: 1, bassin: B, torse: 180, torseL: 0.64, teteS: 1.18, epauleS: 1.12, souffle: s, decor: "mur",
      jD: { x: X0 + fx, y: fy, pied: -62, piedL: 0.6 },
      jG: { x: X0 - fx, y: fy, pied: -118, piedL: 0.6 },
      bD: { x: X0 + 88, y: 236, plie: 1 }, bG: { x: X0 - 88, y: 236, plie: -1 },
      props: [], fleches: [],
      zones: [zone("addD", f), zone("addG", f), zone("poitrine", 0.1 + 0.4 * s, "calme")]
    };
  };

  // Grenouille, vue de dos, sur les avant-bras, genoux écartés. o.v bascule vers l'arrière de 0 à 1
  POSES.grenouille = function (o, s) {
    var k = o.v || 0, B = pt(X0, mix(200, 214, k)), eY = mix(166, 173, k);
    return {
      face: -1, bassin: B, torse: 0, torseL: (B.y - eY) / (L.torse - 5), hancheS: 1.15, epauleS: 1.08, teteS: 0.9, teteD: 0.2, souffle: s || 0, decor: "solDos", cadre: [0, 70, 360, 190],
      ordre: ["tete", "bD", "bG", "jD", "jG", "torse"],
      jD: { m: pt(X0 + 70, 226), x: X0 + 75, y: 243, pied: 0, piedL: 0.75 },
      jG: { m: pt(X0 - 70, 226), x: X0 - 75, y: 243, pied: 180, piedL: 0.75 },
      bD: { m: pt(X0 + 38, 206), x: X0 + 31, y: 190 }, bG: { m: pt(X0 - 38, 206), x: X0 - 31, y: 190 },
      props: [{ t: "genouillere", x: X0 + 70, y: 233 }, { t: "genouillere", x: X0 - 70, y: 233 }],
      fleches: [],
      zones: [zone("addD", 0.35 + 0.5 * k), zone("addG", 0.35 + 0.5 * k)]
    };
  };

  // Bascule adducteur, à quatre pattes vu de dos, une jambe tendue sur le côté. o : { v, cote (jambe tendue) }
  POSES.rockback = function (o, s) {
    var k = o.v || 0, B = pt(X0, mix(170, 194, k)), eY = mix(122, 131, k);
    var hG = pt(X0 - L.hanche * 1.1, B.y), dy = 226 - B.y;
    var piedG = pt(hG.x - Math.sqrt(Math.max(1, JAMBE * JAMBE * 0.99 - dy * dy)), 226);
    var p = {
      face: -1, bassin: B, torse: 0, torseL: (B.y - eY) / (L.torse - 5), hancheS: 1.1, epauleS: 1.06, teteS: 0.9, teteD: 0.3, souffle: s || 0, decor: "solDos", cadre: [0, 70, 360, 190],
      ordre: ["tete", "bD", "bG", "jD", "jG", "torse"],
      jD: { m: pt(X0 + 15, 226), x: X0 + 17, y: 242, pied: 90, piedL: 0.45 },
      jG: { x: piedG.x, y: piedG.y, plie: 1, pied: -90, piedL: 0.5 },
      bD: { x: X0 + 34, y: 202, plie: -1 }, bG: { x: X0 - 34, y: 202, plie: 1 },
      props: [{ t: "genouillere", x: X0 + 15, y: 233 }], fleches: [],
      zones: [zone("addG", 0.35 + 0.55 * k)]
    };
    return o.cote === "D" ? miroir(p) : p;
  };

  // Papillon assis, de face, mains sur les genoux. o : { v (genoux plus bas), c (contraction) }
  POSES.papillon = function (o, s) {
    var d = o.v || 0, c = o.c || 0, B = pt(X0, 212);
    function genou(sg) { return pt(X0 + sg * mix(50, 63, d), mix(186, 204, d)); }
    var gD = genou(-1), gG = genou(1), coul = c > 0.05 ? "effort" : "zone";
    return {
      face: 1, bassin: B, torse: 0, souffle: s || 0, decor: "sol", cadre: [0, 84, 360, 176], hancheS: 1.15,
      jD: { m: gD, x: X0 - 7, y: 224, pied: 0, piedL: 0.45 },
      jG: { m: gG, x: X0 + 7, y: 224, pied: 180, piedL: 0.45 },
      bD: { x: gD.x + 6, y: gD.y - 9, s1: 0.62, s2: 0.6, plie: 1 }, bG: { x: gG.x - 6, y: gG.y - 9, s1: 0.62, s2: 0.6, plie: -1 },
      props: [],
      zones: [zone("addD", 0.3 + 0.5 * c + 0.12 * (1 - (s || 0)), coul), zone("addG", 0.3 + 0.5 * c + 0.12 * (1 - (s || 0)), coul)],
      fleches: c > 0.05 ? [{ x: gD.x - 2, y: gD.y - 30, a: -90, f: c }, { x: gG.x + 2, y: gG.y - 30, a: -90, f: c }] : []
    };
  };

  // Assis en tailleur, de face, pour respirer. Le souffle vient des réglages (o.s) ou du rythme général
  POSES.tailleur = function (o, s) {
    var b = o.s != null ? o.s : (s || 0), B = pt(X0, 210);
    return {
      face: 1, bassin: B, torse: 0, souffle: b, decor: "sol", cadre: [0, 84, 360, 176], hancheS: 1.15,
      jD: { m: pt(X0 - 52, 213), x: X0 + 9, y: 226, pied: 0, piedL: 0.5 },
      jG: { m: pt(X0 + 52, 213), x: X0 - 9, y: 221, pied: 180, piedL: 0.5 },
      bD: { x: X0 - 47, y: 203, plie: 1 }, bG: { x: X0 + 47, y: 203, plie: -1 },
      ordre: ["jG", "jD", "torse", "tete", "bD", "bG"],
      props: [], fleches: [],
      zones: [zone("poitrine", 0.12 + 0.6 * b, "calme")]
    };
  };

  // Balancier latéral, vu de dos, mains au mur. o : { v (degrés, + = vers l'extérieur), cote (jambe qui balance) }
  POSES.balancier = function (o, s) {
    var psi = rad(o.v || 0), B = pt(X0, 118), hG = pt(X0 - L.hanche, 118);
    var p = {
      face: -1, bassin: B, torse: 0, souffle: s || 0, decor: "murFond",
      jD: { x: X0 + 15, y: SOL, plie: 1, pied: 90, piedL: 0.4 },
      jG: { x: hG.x - JAMBE * 0.99 * Math.sin(psi), y: hG.y + JAMBE * 0.99 * Math.cos(psi), plie: 1, pied: 90, piedL: 0.4 },
      bD: { x: X0 + 40, y: 72, s1: 0.62, s2: 0.6, plie: 1 }, bG: { x: X0 - 40, y: 72, s1: 0.62, s2: 0.6, plie: -1 },
      ordre: (o.v || 0) < 0 ? ["jG", "jD", "torse", "tete", "bD", "bG"] : ["jD", "jG", "torse", "tete", "bD", "bG"],
      props: [], fleches: [],
      zones: [zone("addG", Math.max(0, (o.v || 0) / 38) * 0.75)]
    };
    return o.cote === "D" ? miroir(p) : p;
  };

  // Pancake, assis jambes écartées, vu du dessus. o : { v (penché), c (contraction), angle }
  POSES.pancake = function (o, s) {
    var d = o.v || 0, c = o.c || 0, B = pt(X0, 66), base = o.angle || 100;
    var th = rad(mix(base, base + 8, d) / 2);
    var fx = L.hanche + JAMBE * Math.sin(th), fy = B.y + JAMBE * Math.cos(th);
    var coul = c > 0.05 ? "effort" : "zone";
    var p = {
      face: -1, bassin: B, torse: 180, torseL: mix(0.45, 0.85, d), teteS: mix(1.1, 1.02, d), souffle: s || 0, decor: "tapisL",
      jD: { x: X0 - fx, y: fy, pied: -90, piedL: 0.35 }, jG: { x: X0 + fx, y: fy, pied: -90, piedL: 0.35 },
      bD: { x: X0 - 24, y: mix(122, 172, d), plie: 1 }, bG: { x: X0 + 24, y: mix(122, 172, d), plie: -1 },
      props: [], fleches: [],
      zones: [zone("addD", 0.3 + 0.5 * c + 0.2 * d, coul), zone("addG", 0.3 + 0.5 * c + 0.2 * d, coul)]
    };
    if (c > 0.05) p.props.push({ t: "onde", x: X0 - fx, y: fy, f: c }, { t: "onde", x: X0 + fx, y: fy, f: c });
    return p;
  };

  return {
    Scene: Scene, POSES: POSES, melange: melange, douce: douce, mix: mix, clamp: clamp,
    COUL: COUL, L: L, JAMBE: JAMBE, SOL: SOL
  };
})();
