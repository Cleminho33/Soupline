// Soupline · le bonhomme en 3D : un corps articulé (three.js), ses positions, son décor.
// Repère en mètres, y vers le haut, le bonhomme regarde vers +z.
// G = gauche du bonhomme (+x), D = droite (-x). Les angles sont anatomiques et symétriques :
//   hanche [flexion, abduction, rotation externe], genou flexion, cheville [flexion dorsale, bascule],
//   épaule [flexion, abduction, rotation], coude flexion, dos [flexion, inclinaison vers la gauche, rotation].
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const DEG = Math.PI / 180;
const COUL = {
  peau: 0xD49C78, tshirt: 0xE9EDF5, short: 0x283459, cheveux: 0x2F231B, chaussette: 0xF4F5F8,
  zone: 0xFFB547, effort: 0xFF6B5B, calme: 0x5EE0C8
};

// ---------- Outils ----------
function mix(a, b, t) { return a + (b - a) * t; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function matiere(c, r) { return new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.7 : r, metalness: 0 }); }
const SPHERE = new THREE.SphereGeometry(1, 32, 20);

// Un volume de tronc : profil [rayon, hauteur] de bas en haut, fermé aux deux bouts
function tronc(profil) {
  const pts = [new THREE.Vector2(0.001, profil[0][1] - 0.012)];
  const lisse = [];
  for (let i = 0; i < profil.length - 1; i++) {
    for (let k = 0; k < 6; k++) {
      const t = k / 6, a = profil[i], b = profil[i + 1], u = t * t * (3 - 2 * t);
      lisse.push(new THREE.Vector2(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * t));
    }
  }
  const der = profil[profil.length - 1];
  lisse.push(new THREE.Vector2(der[0], der[1]));
  pts.push(...lisse);
  pts.push(new THREE.Vector2(0.001, der[1] + 0.01));
  return new THREE.LatheGeometry(pts, 36);
}

// Un membre : calotte, corps légèrement bombé, calotte, le long de -y depuis l'articulation
function tube(longueur, r1, r2, bombe, haut) {
  const pts = [], b = bombe || 0, h = haut == null ? 0.32 : haut;
  for (let i = 0; i <= 7; i++) { const a = i / 7 * Math.PI / 2; pts.push(new THREE.Vector2(r1 * Math.sin(a), r1 * Math.cos(a))); }
  for (let i = 1; i < 16; i++) {
    const t = i / 16, bos = t < h ? Math.sin(t / h * Math.PI / 2) : Math.cos((t - h) / (1 - h) * Math.PI / 2);
    pts.push(new THREE.Vector2(r1 + (r2 - r1) * t + b * bos, -t * longueur));
  }
  for (let i = 0; i <= 7; i++) { const a = Math.PI / 2 + i / 7 * Math.PI / 2; pts.push(new THREE.Vector2(r2 * Math.sin(a), -longueur + r2 * Math.cos(a))); }
  pts.reverse();
  return new THREE.LatheGeometry(pts, 22);
}
function piece(geo, mat, parent, pos, echelle) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (echelle) m.scale.set(echelle[0], echelle[1], echelle[2]);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function articulation(parent, pos, ordre) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.order = ordre || "XZY";
  parent.add(g);
  return g;
}
function repere(parent, pos, r) {
  const o = new THREE.Object3D();
  o.position.set(pos[0], pos[1], pos[2]);
  o.userData.r = r || 0;
  parent.add(o);
  return o;
}

// ---------- Le corps ----------
class Corps {
  constructor() {
    const M = this.mat = {
      peau: matiere(COUL.peau, 0.55), tshirt: matiere(COUL.tshirt, 0.85), short: matiere(COUL.short, 0.9),
      cheveux: matiere(COUL.cheveux, 0.85), chaussette: matiere(COUL.chaussette, 0.9)
    };
    const R = this.racine = new THREE.Group();
    R.rotation.order = "YXZ";
    this.reperes = {};
    const rp = (nom, parent, pos, r) => { this.reperes[nom] = repere(parent, pos, r); };

    // Bassin et colonne
    piece(SPHERE, M.short, R, [0, -0.012, -0.005], [0.168, 0.122, 0.12]);
    this.lombaires = articulation(R, [0, 0.07, 0]);
    // Le tronc en deux volumes lisses qui se raccordent au niveau de la taille
    piece(tronc([[0.148, -0.07], [0.152, -0.02], [0.146, 0.05], [0.141, 0.11], [0.143, 0.17], [0.146, 0.215]]), M.tshirt, this.lombaires, null, [1, 1, 0.74]);
    this.thorax = articulation(this.lombaires, [0, 0.19, 0]);
    this.poitrine = piece(tronc([[0.144, -0.02], [0.152, 0.04], [0.166, 0.11], [0.176, 0.18], [0.172, 0.23], [0.15, 0.275], [0.1, 0.3], [0.04, 0.312]]), M.tshirt, this.thorax, null, [1, 1, 0.7]);
    this.cou = articulation(this.thorax, [0, 0.285, -0.012]);
    piece(new THREE.CylinderGeometry(0.048, 0.056, 0.13, 20), M.peau, this.cou, [0, 0.045, 0]);
    this.tete = articulation(this.cou, [0, 0.09, 0]);
    piece(SPHERE, M.peau, this.tete, [0, 0.095, 0.012], [0.098, 0.118, 0.108]);
    const capuche = new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const cheveux = piece(capuche, M.cheveux, this.tete, [0, 0.104, 0.0], [0.104, 0.122, 0.114]);
    cheveux.rotation.x = -0.5;
    piece(SPHERE, M.peau, this.tete, [0, 0.085, 0.118], [0.018, 0.024, 0.02]);   // le nez : on sait où il regarde
    piece(SPHERE, M.peau, this.tete, [0.098, 0.09, 0.0], [0.016, 0.03, 0.022]);  // oreilles
    piece(SPHERE, M.peau, this.tete, [-0.098, 0.09, 0.0], [0.016, 0.03, 0.022]);

    rp("fesseG", R, [0.075, -0.07, -0.075], 0.06); rp("fesseD", R, [-0.075, -0.07, -0.075], 0.06);
    rp("ischionG", R, [0.07, -0.11, -0.02], 0.03); rp("ischionD", R, [-0.07, -0.11, -0.02], 0.03);
    rp("flancG", R, [0.165, -0.015, 0], 0.03); rp("flancD", R, [-0.165, -0.015, 0], 0.03);
    rp("ventre", R, [0, 0, 0.115], 0.02);
    rp("bassin", R, [0, 0, 0], 0);
    rp("lombes", this.lombaires, [0, 0.08, -0.1], 0.015);
    rp("ventreHaut", this.lombaires, [0, 0.08, 0.1], 0.015);
    rp("omoplates", this.thorax, [0, 0.14, -0.11], 0.02);
    rp("sternum", this.thorax, [0, 0.13, 0.11], 0.02);
    rp("poitrineG", this.thorax, [0.17, 0.12, 0], 0.02); rp("poitrineD", this.thorax, [-0.17, 0.12, 0], 0.02);
    rp("teteCentre", this.tete, [0, 0.095, 0.01], 0.115);
    rp("menton", this.tete, [0, 0.0, 0.09], 0.02);
    rp("nuque", this.tete, [0, 0.06, -0.1], 0.02);

    // Bras et jambes, des deux côtés
    this.membres = {};
    for (const [c, s] of [["G", 1], ["D", -1]]) {
      const ep = articulation(this.thorax, [s * 0.172, 0.24, -0.012]);
      piece(SPHERE, M.tshirt, ep, [-s * 0.008, -0.005, 0], [0.058, 0.06, 0.058]);
      piece(tube(0.28, 0.051, 0.04, 0.007, 0.35), M.peau, ep);
      piece(tube(0.115, 0.062, 0.057), M.tshirt, ep);
      const co = articulation(ep, [0, -0.28, 0]);
      piece(tube(0.255, 0.041, 0.03, 0.007, 0.25), M.peau, co);
      const po = articulation(co, [0, -0.255, 0]);
      piece(SPHERE, M.peau, po, [0, -0.07, 0.006], [0.041, 0.078, 0.021]);
      piece(SPHERE, M.peau, po, [-s * 0.012, -0.035, 0.03], [0.014, 0.034, 0.014]).rotation.x = 0.5;
      rp("epaule" + c, ep, [0, 0.02, 0], 0.06);
      rp("coude" + c, co, [0, 0, -0.01], 0.045);
      rp("main" + c, po, [0, -0.075, 0], 0.022);

      const ha = articulation(R, [s * 0.09, -0.045, 0]);
      piece(tube(0.44, 0.088, 0.056, 0.011, 0.3), M.peau, ha);
      piece(tube(0.2, 0.098, 0.088, 0.004), M.short, ha);
      const ge = articulation(ha, [0, -0.44, 0]);
      piece(SPHERE, M.peau, ge, [0, -0.005, 0.016], [0.054, 0.056, 0.05]);
      piece(tube(0.43, 0.056, 0.035, 0.014, 0.28), M.peau, ge);
      piece(tube(0.1, 0.041, 0.04), M.chaussette, ge, [0, -0.34, 0]);
      const ch = articulation(ge, [0, -0.43, 0]);
      piece(SPHERE, M.chaussette, ch, [0, -0.032, 0.06], [0.046, 0.035, 0.128]);
      rp("genou" + c, ge, [0, -0.005, 0.045], 0.03);
      rp("genouCentre" + c, ge, [0, 0, 0], 0.056);
      rp("genouArriere" + c, ge, [0, -0.02, -0.04], 0.03);
      rp("cuisseExt" + c, ha, [s * 0.08, -0.24, 0], 0.01);
      rp("cuisseInt" + c, ha, [-s * 0.07, -0.24, 0], 0.01);
      rp("mollet" + c, ge, [0, -0.15, -0.06], 0.01);
      rp("tibia" + c, ge, [0, -0.22, 0.045], 0.01);
      rp("talon" + c, ch, [0, -0.06, -0.035], 0.008);
      rp("orteils" + c, ch, [0, -0.055, 0.17], 0.012);
      rp("piedExt" + c, ch, [s * 0.044, -0.05, 0.07], 0.008);
      rp("piedInt" + c, ch, [-s * 0.044, -0.05, 0.07], 0.008);
      rp("cheville" + c, ch, [0, 0, 0], 0.03);
      this.membres[c] = { s: s, epaule: ep, coude: co, poignet: po, hanche: ha, genou: ge, cheville: ch };

      // La zone qui s'allume : l'intérieur de la cuisse (adducteurs)
      const zm = new THREE.MeshBasicMaterial({ color: COUL.zone, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const z1 = new THREE.Mesh(SPHERE, zm); z1.position.set(-s * 0.05, -0.17, 0.012); z1.scale.set(0.04, 0.12, 0.055); z1.renderOrder = 5;
      const zm2 = zm.clone();
      const z2 = new THREE.Mesh(SPHERE, zm2); z2.position.set(-s * 0.052, -0.17, 0.012); z2.scale.set(0.06, 0.16, 0.075); z2.renderOrder = 6;
      ha.add(z1); ha.add(z2);
      this["zone" + c] = [z1, z2];
    }
    const cm = new THREE.MeshBasicMaterial({ color: COUL.calme, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.zonePoitrine = new THREE.Mesh(SPHERE, cm);
    this.zonePoitrine.position.set(0, 0.13, 0.11); this.zonePoitrine.scale.set(0.06, 0.06, 0.03); this.zonePoitrine.renderOrder = 5;
    this.thorax.add(this.zonePoitrine);
  }

  // Les angles de la pose, sans placer le corps au sol
  angles(p) {
    const R = this.racine;
    R.position.set(p.x || 0, 0, p.z || 0);
    R.rotation.set((p.rx || 0) * DEG, (p.ry || 0) * DEG, (p.rz || 0) * DEG);
    const d = p.dos || [0, 0, 0];
    this.lombaires.rotation.set(d[0] * 0.55 * DEG, (d[2] || 0) * 0.5 * DEG, -(d[1] || 0) * 0.5 * DEG);
    this.thorax.rotation.set(d[0] * 0.45 * DEG, (d[2] || 0) * 0.5 * DEG, -(d[1] || 0) * 0.5 * DEG);
    const t = p.tete || [0, 0];
    this.tete.rotation.set((t[0] || 0) * DEG, (t[1] || 0) * DEG, 0);
    const s = p.souffle || 0;
    this.poitrine.scale.set(1 + 0.025 * s, 1 + 0.012 * s, 0.7 * (1 + 0.05 * s));
    for (const c of ["G", "D"]) {
      const m = this.membres[c], sg = m.s;
      const h = p["hanche" + c] || [0, 0, 0], e = p["epaule" + c] || [0, 0, 0], ch = p["cheville" + c] || [0, 0];
      m.hanche.rotation.set(-h[0] * DEG, sg * (h[2] || 0) * DEG, sg * h[1] * DEG);
      m.genou.rotation.set((p["genou" + c] || 0) * DEG, 0, 0);
      m.cheville.rotation.set(-(ch[0] || 0) * DEG, 0, sg * (ch[1] || 0) * DEG);
      m.epaule.rotation.set(-e[0] * DEG, sg * (e[2] || 0) * DEG, sg * (e[1] - 1.5 * s) * DEG);
      m.coude.rotation.set(-(p["coude" + c] || 0) * DEG, 0, 0);
      m.poignet.rotation.set(-((p["poignet" + c] || 0)) * DEG, 0, 0);
    }
    R.updateMatrixWorld(true);
  }
  point(nom) { return this.reperes[nom].getWorldPosition(new THREE.Vector3()); }
  contact(nom) { const v = this.point(nom); return v.y - this.reperes[nom].userData.r; }
  plusBas() {
    let m = Infinity;
    for (const k in this.reperes) { const r = this.reperes[k]; const y = r.getWorldPosition(TMP).y - r.userData.r; if (y < m) m = y; }
    return m;
  }
}
const TMP = new THREE.Vector3();

// Le corps posé : angles, réglages par recherche (pieds au sol, genou sur le banc…), puis au sol
function poser(corps, p) {
  corps.angles(p);
  (p.ajuster || []).forEach((a) => {
    // Recherche par dichotomie de la valeur qui amène un point à la hauteur voulue
    const lire = () => corps.contact(a.point) - (typeof a.cible === "string" ? corps.contact(a.cible) : a.cible + (a.relatif ? 0 : corps.plusBas()));
    let lo = a.de, hi = a.a;
    ecrire(p, a.cle, lo); corps.angles(p); const flo = lire();
    ecrire(p, a.cle, hi); corps.angles(p); const fhi = lire();
    if (flo * fhi > 0) { ecrire(p, a.cle, Math.abs(flo) < Math.abs(fhi) ? lo : hi); corps.angles(p); return; }
    for (let i = 0; i < 16; i++) {
      const mi = (lo + hi) / 2;
      ecrire(p, a.cle, mi); corps.angles(p);
      const f = lire();
      if ((f > 0) === (flo > 0)) lo = mi; else hi = mi;
    }
    ecrire(p, a.cle, (lo + hi) / 2); corps.angles(p);
  });
  const bas = corps.plusBas();
  corps.racine.position.y -= bas;
  if (p.epingle) {
    // Garde un point immobile au sol (le pied d'appui, les mains) pendant le mouvement
    corps.racine.updateMatrixWorld(true);
    const v = corps.point(p.epingle.point);
    if (p.epingle.x != null) corps.racine.position.x += p.epingle.x - v.x;
    if (p.epingle.z != null) corps.racine.position.z += p.epingle.z - v.z;
  }
  corps.racine.updateMatrixWorld(true);
}
function ecrire(p, cle, v) {
  const m = cle.match(/^(\w+?)(?:\.(\d))?$/);
  if (m[2] == null) p[m[1]] = v; else { p[m[1]] = (p[m[1]] || [0, 0, 0]).slice(); p[m[1]][+m[2]] = v; }
}

// ---------- Les positions ----------
// Même signature que la version dessinée : (réglages, souffle de 0 à 1) → une pose.
function base() {
  return {
    rx: 0, ry: 0, rz: 0, x: 0, z: 0, dos: [0, 0, 0], tete: [0, 0],
    hancheG: [0, 3, 0], genouG: 2, chevilleG: [0, 0], hancheD: [0, 3, 0], genouD: 2, chevilleD: [0, 0],
    epauleG: [0, 9, 0], coudeG: 10, epauleD: [0, 9, 0], coudeD: 10,
    souffle: 0, zones: [], props: [], decor: "sol", ajuster: [], vue: { az: 18, el: 10 }
  };
}
function zone(ou, f, c) { return { ou: ou, f: clamp(f, 0, 1), c: c || "zone" }; }
// La pose vue dans un miroir : droite et gauche échangées
function miroir(p) {
  const m = JSON.parse(JSON.stringify(p)), sw = (k) => k.replace(/G$/, "#").replace(/D$/, "G").replace(/#$/, "D");
  for (const k of ["hanche", "genou", "cheville", "epaule", "coude", "poignet"]) { const t = m[k + "G"]; m[k + "G"] = m[k + "D"]; m[k + "D"] = t; }
  m.ry = -(m.ry || 0); m.rz = -(m.rz || 0); m.x = -(m.x || 0);
  if (m.dos) { m.dos[1] = -(m.dos[1] || 0); m.dos[2] = -(m.dos[2] || 0); }
  if (m.tete) m.tete[1] = -(m.tete[1] || 0);
  m.zones.forEach((z) => { z.ou = sw(z.ou); });
  m.props.forEach((q) => { ["sur", "sous", "point"].forEach((k) => { if (q[k]) q[k] = sw(q[k]); }); if (q.entre) q.entre = q.entre.map(sw); });
  m.ajuster.forEach((a) => { a.cle = a.cle.replace(/(hanche|genou|cheville|epaule|coude)([GD])/, (x, n, c) => n + (c === "G" ? "D" : "G")); a.point = sw(a.point); if (typeof a.cible === "string") a.cible = sw(a.cible); if (a.cle === "rz" || a.cle === "ry") { const t = a.de; a.de = -a.a; a.a = -t; } });
  if (m.epingle) { m.epingle.point = sw(m.epingle.point); if (m.epingle.x != null) m.epingle.x = -m.epingle.x; }
  if (m.vue) m.vue.az = -m.vue.az;
  return m;
}
const BRAS_PRIERE = { epauleG: [36, 4, -50], coudeG: 104, epauleD: [36, 4, -50], coudeD: 104 };
function avec(p, o) { for (const k in o) p[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; return p; }

export const POSES = {};

// Grand écart debout, mains sur deux appuis (ou bras en étoile pour l'accueil)
POSES.ecart = function (o, s) {
  s = s || 0;
  let A = o.a0 != null ? mix(o.a0, o.a1, o.v || 0) : (o.angle == null ? 80 : o.angle);
  A = clamp(A + (o.bras === "etoile" ? 0 : (1 - s) * 1.5), 20, 178);
  const a = A / 2, c = o.c || 0, p = base(), etoile = o.bras === "etoile";
  p.hancheG = [0, a, 0]; p.hancheD = [0, a, 0]; p.genouG = 0; p.genouD = 0;
  p.chevilleG = [0, -a]; p.chevilleD = [0, -a];
  p.souffle = s; p.angle = A;
  if (etoile) {
    avec(p, { epauleG: [0, 108, 0], epauleD: [0, 108, 0], coudeG: 6, coudeD: 6, tete: [-4, 0] });
    p.vue = { az: 0, el: 6 };
    if (o.zones) p.zones.push(zone("addG", 0.35 + 0.15 * (1 - s)), zone("addD", 0.35 + 0.15 * (1 - s)));
  } else {
    const pench = mix(30, 42, clamp((A - 60) / 110, 0, 1));
    avec(p, { rx: pench, dos: [18, 0, 0], tete: [-26, 0], epauleG: [74, 14, 0], epauleD: [74, 14, 0], coudeG: 6, coudeD: 6 });
    p.hancheG[0] = pench; p.hancheD[0] = pench;
    p.props.push({ t: "appui", sur: "mainG" }, { t: "appui", sur: "mainD" });
    const coul = c > 0.05 ? "effort" : "zone", f = 0.35 + 0.5 * c + 0.15 * (1 - s);
    p.zones.push(zone("addG", f, coul), zone("addD", f, coul));
    p.vue = { az: 0, el: 9 };
  }
  return p;
};

// Fente cosaque : o.v de -1 (en bas sur la jambe droite) à +1 (sur la gauche)
POSES.cosaque = function (o, s) {
  const v = o.v || 0, k = Math.abs(v), p = base();
  avec(p, BRAS_PRIERE);
  p.souffle = s || 0;
  const B = v < 0 ? "D" : "G", S = v < 0 ? "G" : "D";
  p["hanche" + B] = [mix(4, 84, k), mix(24, 30, k), mix(8, 34, k)];
  p["genou" + B] = mix(4, 118, k);
  p["cheville" + B] = [mix(0, 28, k), mix(-22, -24, k)];
  p["hanche" + S] = [mix(4, 6, k), 24, mix(8, 72, k)];
  p["genou" + S] = mix(4, 0, k);
  p["cheville" + S] = [mix(0, 34, k), mix(-22, -10, k)];
  p.rx = mix(4, 20, k); p.dos = [mix(4, 14, k), 0, 0]; p.tete = [mix(0, -12, k), 0];
  p.ajuster.push({ cle: "hanche" + S + ".1", de: 10, a: 80, point: "talon" + S, cible: "talon" + B });
  p.epingle = { point: "talon" + B, x: v < 0 ? -0.36 : 0.36 };
  if (k < 0.02) p.epingle = null;
  p.zones.push(zone("add" + S, k * (0.65 + 0.25 * (1 - (s || 0)))));
  p.vue = { az: 0, el: 8 };
  return p;
};

// Cavalier : jambes larges, on descend genoux vers l'extérieur
POSES.cavalier = function (o, s) {
  const k = o.v || 0, p = base();
  avec(p, BRAS_PRIERE);
  p.souffle = s || 0;
  for (const c of ["G", "D"]) {
    p["hanche" + c] = [mix(6, 72, k), mix(30, 36, k), mix(20, 34, k)];
    p["genou" + c] = mix(8, 100, k);
    p["cheville" + c] = [mix(4, 26, k), mix(-28, -24, k)];
  }
  p.rx = mix(2, 12, k); p.dos = [mix(0, 6, k), 0, 0];
  const coul = o.effort ? "effort" : "zone";
  p.zones.push(zone("addG", 0.2 + 0.4 * k, coul), zone("addD", 0.2 + 0.4 * k, coul));
  p.vue = { az: 0, el: 8 };
  return p;
};

// Glissade en écart : la jambe gauche glisse sur le côté (o.cote = "D" pour la droite), mains sur une chaise
POSES.glissade = function (o, s) {
  const k = o.v || 0, tire = o.tire || 0, p = base();
  p.souffle = s || 0;
  p.hancheD = [mix(4, 52, k), 4, 8]; p.genouD = mix(4, 78, k); p.chevilleD = [mix(0, 30, k), 0];
  p.hancheG = [mix(4, 14, k), 8, 12]; p.genouG = 0; p.chevilleG = [0, 0];
  p.rx = mix(6, 24, k); p.dos = [mix(4, 14, k), 0, 0];
  avec(p, { epauleG: [mix(52, 70, k), 14, 0], epauleD: [mix(52, 70, k), 14, 0], coudeG: mix(40, 20, k), coudeD: mix(40, 20, k), tete: [mix(0, -10, k), 0] });
  p.ajuster.push({ cle: "hancheG.1", de: 4, a: 80, point: "talonG", cible: "talonD" });
  p.chevilleG[1] = 0;
  p.epingle = { point: "talonD", x: -0.1 };
  p.props.push({ t: "chaise" }, { t: "serviette", sous: "talonG" }, { t: "serviette", sous: "talonD" });
  p.zones.push(zone("addG", k * 0.85, tire > 0.5 ? "effort" : "zone"));
  p.vue = { az: 200, el: 14 };
  return o.cote === "D" ? miroir(p) : p;
};

// Copenhague : allongé sur le côté droit, avant-bras au sol, genou gauche sur un banc (o.cote = "D" : l'inverse)
POSES.copenhague = function (o, s) {
  const k = o.v || 0, p = base();
  p.souffle = s || 0;
  p.rz = mix(72, 98, k);
  p.epauleD = [6, 92, 0]; p.coudeD = 92;
  p.epauleG = [8, 16, 0]; p.coudeG = 104;
  p.hancheG = [8, 6, 0]; p.genouG = o.long ? 2 : 16; p.chevilleG = [10, 0];
  p.hancheD = [6, 10, 0]; p.genouD = 6; p.chevilleD = [10, 0];
  p.tete = [0, 0];
  const genou = o.long ? "talonG" : "genouCentreG";
  p.ajuster.push({ cle: "hancheG.1", de: -40, a: 60, point: genou, cible: 0.43 });
  p.ajuster.push({ cle: "hancheD.1", de: -20, a: 70, point: "piedExtD", cible: "coudeD" });
  p.props.push({ t: "banc", sous: genou });
  p.zones.push(zone("addG", 0.3 + 0.6 * k, k > 0.5 ? "effort" : "zone"));
  p.vue = { az: 4, el: 12 };
  return o.cote === "D" ? miroir(p) : p;
};

// Coussin serré entre les genoux, allongé sur le dos
POSES.squeeze = function (o, s) {
  const k = o.c || 0, p = base(), r = o.doux ? 0.5 : 1;
  p.rx = -90; p.souffle = s || 0;
  p.hancheG = [52, mix(12, 2, k), 0]; p.hancheD = [52, mix(12, 2, k), 0];
  p.genouG = 104; p.genouD = 104; p.chevilleG = [8, 0]; p.chevilleD = [8, 0];
  avec(p, { epauleG: [0, 16, 0], epauleD: [0, 16, 0], coudeG: 6, coudeD: 6 });
  p.ajuster.push({ cle: "hancheG.0", de: 25, a: 85, point: "talonG", cible: "fesseG" }, { cle: "hancheD.0", de: 25, a: 85, point: "talonD", cible: "fesseD" });
  p.props.push({ t: "tapis" }, { t: "coussin", entre: ["genouCentreG", "genouCentreD"], serre: k });
  p.zones.push(zone("addG", (0.15 + 0.7 * k) * r, "effort"), zone("addD", (0.15 + 0.7 * k) * r, "effort"));
  p.vue = { az: 32, el: 32 };
  return p;
};

// Papillon allongé : plantes de pieds collées, genoux qui tombent sur les côtés
POSES.papillonAllonge = function (o, s) {
  const k = o.v || 0, p = base();
  p.rx = -90; p.souffle = s || 0;
  for (const c of ["G", "D"]) { p["hanche" + c] = [50, mix(12, 62, k), mix(10, 40, k)]; p["genou" + c] = 118; p["cheville" + c] = [6, mix(0, 30, k)]; }
  avec(p, { epauleG: [12, 30, -80], epauleD: [12, 30, -80], coudeG: 96, coudeD: 96 });
  p.ajuster.push({ cle: "hancheG.0", de: 20, a: 85, point: "talonG", cible: "fesseG" }, { cle: "hancheD.0", de: 20, a: 85, point: "talonD", cible: "fesseD" });
  p.props.push({ t: "tapis" });
  p.zones.push(zone("addG", 0.2 + 0.45 * k), zone("addD", 0.2 + 0.45 * k), zone("poitrine", 0.15 + 0.4 * (s || 0), "calme"));
  p.vue = { az: 8, el: 42 };
  return p;
};

// Jambes au mur en V : allongé, fesses contre le mur
POSES.murV = function (o, s) {
  s = s || 0;
  const A = clamp((o.angle || 80) + (1 - s) * 2, 10, 176), p = base();
  p.rx = -90; p.souffle = s;
  p.hancheG = [88, A / 2, 4]; p.hancheD = [88, A / 2, 4]; p.genouG = 3; p.genouD = 3;
  p.chevilleG = [-14, 0]; p.chevilleD = [-14, 0];
  avec(p, { epauleG: [0, 62, 0], epauleD: [0, 62, 0], coudeG: 14, coudeD: 14 });
  p.props.push({ t: "tapis" }, { t: "mur" });
  const f = A < 45 ? 0.1 : 0.28 + 0.22 * (1 - s);
  p.zones.push(zone("addG", f), zone("addD", f), zone("poitrine", 0.15 + 0.4 * s, "calme"));
  p.vue = { az: 162, el: 26 };
  return p;
};

// Grenouille : sur les avant-bras, genoux très écartés, on bascule vers l'arrière
POSES.grenouille = function (o, s) {
  const k = o.v || 0, p = base();
  p.rx = 82; p.souffle = s || 0;
  for (const c of ["G", "D"]) {
    p["hanche" + c] = [mix(70, 96, k), 78, 18]; p["genou" + c] = 92; p["cheville" + c] = [20, 0];
    p["epaule" + c] = [96, 8, 0]; p["coude" + c] = 92;
  }
  p.tete = [-8, 0];
  p.ajuster.push({ cle: "rx", de: 55, a: 110, point: "coudeG", cible: "genouG" });
  p.epingle = { point: "coudeG", z: 0.32 };
  p.props.push({ t: "tapis" }, { t: "genouillere", sous: "genouG" }, { t: "genouillere", sous: "genouD" });
  p.zones.push(zone("addG", 0.35 + 0.5 * k), zone("addD", 0.35 + 0.5 * k));
  p.vue = { az: 150, el: 48 };
  return p;
};

// Bascule adducteur : à quatre pattes, la jambe gauche tendue sur le côté (o.cote = "D" : la droite)
POSES.rockback = function (o, s) {
  const k = o.v || 0, p = base();
  p.rx = 74; p.souffle = s || 0;
  p.hancheD = [mix(84, 122, k), 2, 0]; p.genouD = mix(90, 124, k); p.chevilleD = [-30, 0];
  p.hancheG = [mix(8, 30, k), 84, -86]; p.genouG = 0; p.chevilleG = [0, 0];
  p.epauleG = [mix(82, 112, k), 4, 0]; p.epauleD = [mix(82, 112, k), 4, 0]; p.coudeG = 4; p.coudeD = 4;
  p.tete = [-10, 0];
  p.ajuster.push({ cle: "rx", de: 40, a: 110, point: "mainD", cible: "genouD" });
  p.epingle = { point: "mainD", z: 0.36 };
  p.props.push({ t: "tapis" }, { t: "genouillere", sous: "genouD" });
  p.zones.push(zone("addG", 0.35 + 0.55 * k));
  p.vue = { az: 138, el: 30 };
  return o.cote === "D" ? miroir(p) : p;
};

// Papillon assis : plantes de pieds collées, mains sur les genoux
POSES.papillon = function (o, s) {
  const d = o.v || 0, c = o.c || 0, p = base();
  p.souffle = s || 0;
  for (const cc of ["G", "D"]) { p["hanche" + cc] = [66, mix(46, 58, d) - 3 * c, 40]; p["genou" + cc] = 128; p["cheville" + cc] = [8, 26]; }
  p.rx = 8; p.dos = [10, 0, 0]; p.tete = [6, 0];
  avec(p, { epauleG: [34, 20, -14], epauleD: [34, 20, -14], coudeG: 16, coudeD: 16 });
  const coul = c > 0.05 ? "effort" : "zone";
  p.zones.push(zone("addG", 0.3 + 0.5 * c + 0.12 * (1 - (s || 0)), coul), zone("addD", 0.3 + 0.5 * c + 0.12 * (1 - (s || 0)), coul));
  p.props.push({ t: "tapis" });
  p.vue = { az: 20, el: 16 };
  return p;
};

// Assis en tailleur, pour respirer. Le souffle vient des réglages (o.s) ou du rythme général
POSES.tailleur = function (o, s) {
  const b = o.s != null ? o.s : (s || 0), p = base();
  p.souffle = b;
  p.hancheG = [74, 44, 52]; p.hancheD = [74, 44, 52]; p.genouG = 142; p.genouD = 146;
  p.chevilleG = [0, -12]; p.chevilleD = [0, -12];
  p.dos = [4 - 4 * b, 0, 0]; p.tete = [-2 - 3 * b, 0];
  p.rx = 6;
  avec(p, { epauleG: [26, 22, -14], epauleD: [26, 22, -14], coudeG: 22, coudeD: 22 });
  p.props.push({ t: "tapis" });
  p.zones.push(zone("poitrine", 0.15 + 0.6 * b, "calme"));
  p.vue = { az: 16, el: 12 };
  return p;
};

// Balancier latéral : face au mur, mains posées, la jambe gauche balance (o.cote = "D" : la droite)
POSES.balancier = function (o, s) {
  const psi = o.v || 0, p = base();
  p.souffle = s || 0;
  p.hancheD = [0, 3, 0]; p.genouD = 3;
  p.hancheG = [psi < 0 ? -psi * 0.5 : 6, psi, 4]; p.genouG = 4;
  avec(p, { epauleG: [86, 12, 0], epauleD: [86, 12, 0], coudeG: 24, coudeD: 24 });
  p.props.push({ t: "murFace" });
  p.epingle = { point: "talonD", x: -0.1 };
  p.zones.push(zone("addG", Math.max(0, psi / 38) * 0.75));
  p.vue = { az: 196, el: 12 };
  return o.cote === "D" ? miroir(p) : p;
};

// Pancake : gardé pour plus tard, même dessin que l'écart assis
POSES.pancake = function (o, s) {
  const d = o.v || 0, p = base(), A = o.angle || 100;
  p.souffle = s || 0;
  for (const c of ["G", "D"]) { p["hanche" + c] = [mix(80, 110, d), A / 2, 70]; p["genou" + c] = 0; p["cheville" + c] = [10, 0]; }
  p.dos = [mix(10, 40, d), 0, 0]; p.epauleG = [mix(60, 100, d), 12, 0]; p.epauleD = [mix(60, 100, d), 12, 0];
  p.props.push({ t: "tapis" });
  p.zones.push(zone("addG", 0.4 + 0.3 * d), zone("addD", 0.4 + 0.3 * d));
  p.vue = { az: 20, el: 30 };
  return p;
};

// ---------- La scène ----------
let degradeSol = null;
function textureSol() {
  if (degradeSol) return degradeSol;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), r = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  r.addColorStop(0, "rgba(64,80,150,0.55)"); r.addColorStop(0.55, "rgba(40,52,105,0.28)"); r.addColorStop(1, "rgba(20,28,60,0)");
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  degradeSol = new THREE.CanvasTexture(c); degradeSol.colorSpace = THREE.SRGBColorSpace;
  return degradeSol;
}

const MAT_DECOR = {
  tapis: matiere(0x3F3577, 0.95), appui: matiere(0x41528F, 0.8), appuiHaut: matiere(0x5A6CB0, 0.7), bois: matiere(0x5B6798, 0.75),
  banc: matiere(0x3A4777, 0.85), coussin: matiere(0x8C7BFF, 0.9), serviette: matiere(0x3C8C86, 0.95), mur: matiere(0x2B3868, 1),
  plinthe: matiere(0x45558F, 0.9), genouillere: matiere(0x2E3A6A, 0.95)
};
const BOITE = new THREE.BoxGeometry(1, 1, 1);

export class Scene {
  constructor(conteneur, opts) {
    opts = opts || {};
    this.el = conteneur; this.opts = opts;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.capture });
    r.setPixelRatio(Math.min(opts.capture ? 2 : 2, window.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    if (conteneur) { conteneur.appendChild(r.domElement); r.domElement.style.display = "block"; r.domElement.style.width = "100%"; r.domElement.style.height = "100%"; }
    const sc = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
    sc.add(new THREE.HemisphereLight(0xC5D0FF, 0x1A1F38, 1.15));
    const cle = new THREE.DirectionalLight(0xFFF1E0, 2.1);
    cle.position.set(1.6, 3.4, 2.6); cle.castShadow = true;
    cle.shadow.mapSize.set(1024, 1024); cle.shadow.radius = 4; cle.shadow.bias = -0.0005;
    Object.assign(cle.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.5, far: 9 });
    sc.add(cle);
    const contre = new THREE.DirectionalLight(0x8E7CFF, 1.25); contre.position.set(-2.2, 2.0, -2.6); sc.add(contre);
    const appoint = new THREE.DirectionalLight(0x5EE0C8, 0.35); appoint.position.set(2.5, 0.6, -1.5); sc.add(appoint);
    const ombre = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.38 }));
    ombre.rotation.x = -Math.PI / 2; ombre.receiveShadow = true; sc.add(ombre);
    const disque = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshBasicMaterial({ map: textureSol(), transparent: true, depthWrite: false }));
    disque.rotation.x = -Math.PI / 2; disque.position.y = 0.001; sc.add(disque);
    this.corps = new Corps(); sc.add(this.corps.racine);
    this.decor = new THREE.Group(); sc.add(this.decor);
    this.objets = {};
    this.cleVue = null; this.vueCourante = null; this.cible = new THREE.Vector3(0, 0.8, 0); this.rayon = 1.2;
    if (opts.controles && conteneur) {
      const c = this.controls = new OrbitControls(this.camera, r.domElement);
      c.enableDamping = true; c.dampingFactor = 0.12; c.enablePan = false;
      c.minDistance = 1.2; c.maxDistance = 9; c.maxPolarAngle = Math.PI * 0.49; c.rotateSpeed = 0.8;
      c.addEventListener("start", () => { this.touche = true; if (this.opts.surTouche) this.opts.surTouche(); });
    }
    if (conteneur && "ResizeObserver" in window) { this.ro = new ResizeObserver(() => this.redimensionner()); this.ro.observe(conteneur); }
    this.redimensionner();
  }
  // Déplace le dessin dans un autre conteneur (l'accueil se redessine souvent : on garde le même contexte 3D)
  attacher(conteneur) {
    if (!conteneur || conteneur === this.el) return;
    this.el = conteneur;
    conteneur.appendChild(this.renderer.domElement);
    if (this.ro) { this.ro.disconnect(); this.ro.observe(conteneur); }
    this.redimensionner();
  }
  redimensionner(w, h) {
    w = w || (this.el ? this.el.clientWidth : 300) || 300; h = h || (this.el ? this.el.clientHeight : 220) || 220;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.vueCourante) this.placerCamera(this.vueCourante, true);
    this.rendre();
  }
  // Une pose : angles, réglages, sol, décor, zones, puis on dessine
  dessiner(pose) {
    const p = JSON.parse(JSON.stringify(pose));
    poser(this.corps, p);
    this.majDecor(p);
    this.majZones(p);
    const cle = p.cleVue || JSON.stringify(p.vue || {});
    if (cle !== this.cleVue) { this.cleVue = cle; this.cadrer(p.vue || { az: 18, el: 10 }); }
    this.rendre();
  }
  // Cadre la caméra sur le corps et ses accessoires pour une vue donnée (az, el en degrés)
  cadrer(vue) {
    const box = new THREE.Box3();
    // Chaque repère compte avec son épaisseur (la tête dépasse de son centre)
    for (const k in this.corps.reperes) {
      const p = this.corps.point(k), r = this.corps.reperes[k].userData.r || 0;
      box.expandByPoint(p.clone().addScalar(r)); box.expandByPoint(p.addScalar(-r));
    }
    this.decor.children.forEach((o) => { if (o.visible && !o.userData.horsCadre) box.expandByObject(o); });
    box.min.y = Math.min(box.min.y, 0);
    const sph = box.getBoundingSphere(new THREE.Sphere());
    this.cible.copy(sph.center); this.rayon = Math.max(0.45, sph.radius);
    // opts.decale : vise un peu plus haut pour laisser de la place aux boutons posés en haut de l'image
    this.cible.y += this.rayon * (this.opts.decale || 0);
    this.vueBase = { az: vue.az, el: vue.el };
    this.placerCamera(this.vueBase, true);
  }
  placerCamera(v, net) {
    this.vueCourante = v;
    const az = v.az * DEG, el = clamp(v.el, -5, 85) * DEG;
    const fov = this.camera.fov * DEG, asp = Math.max(0.6, this.camera.aspect);
    const d = this.rayon / Math.sin(Math.min(fov, fov * asp) / 2) * (this.opts.serre || 1.02);
    const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(this.cible);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.cible);
    if (this.controls) { this.controls.target.copy(this.cible); this.controls.update(); }
  }
  // Vues proposées à l'écran : celle de l'exercice, de face, de côté, de dessus
  vue(nom) {
    const b = this.vueBase || { az: 18, el: 10 };
    const v = nom === "face" ? { az: 0, el: 8 } : nom === "cote" ? { az: 90, el: 8 } : nom === "dessus" ? { az: b.az, el: 80 } : b;
    this.placerCamera(v, true);
    this.rendre();
  }
  tourner(degres) {
    const v = this.vueCourante || this.vueBase || { az: 0, el: 8 };
    this.placerCamera({ az: v.az + degres, el: v.el }, true);
  }
  rendre() {
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  majZones(p) {
    const C = this.corps, val = { addG: null, addD: null, poitrine: null };
    (p.zones || []).forEach((z) => { val[z.ou] = z; });
    for (const c of ["G", "D"]) {
      const z = val["add" + c], m = C["zone" + c];
      const f = z ? z.f : 0, col = z ? COUL[z.c] || COUL.zone : COUL.zone;
      m[0].material.opacity = f * 0.75; m[1].material.opacity = f * 0.32;
      m[0].material.color.setHex(col); m[1].material.color.setHex(col);
    }
    const zp = val.poitrine;
    C.zonePoitrine.material.opacity = zp ? zp.f * 0.3 : 0;
    const sc = zp ? 0.05 + 0.04 * zp.f : 0.05;
    C.zonePoitrine.scale.set(sc, sc, sc * 0.5);
  }
  objet(cle, creer) {
    if (!this.objets[cle]) { this.objets[cle] = creer(); this.decor.add(this.objets[cle]); }
    const o = this.objets[cle]; o.visible = true; o.userData.vu = true;
    return o;
  }
  majDecor(p) {
    const C = this.corps;
    for (const k in this.objets) this.objets[k].userData.vu = false;
    let n = { appui: 0, serviette: 0, genouillere: 0 };
    (p.props || []).forEach((q) => {
      if (q.t === "appui") {
        const o = this.objet("appui" + (n.appui++), () => {
          const g = new THREE.Group();
          const b = new THREE.Mesh(BOITE, MAT_DECOR.appui); b.castShadow = b.receiveShadow = true; g.add(b);
          const h = new THREE.Mesh(BOITE, MAT_DECOR.appuiHaut); h.castShadow = true; g.add(h);
          g.userData.b = b; g.userData.h = h; return g;
        });
        const m = C.point(q.sur), hh = Math.max(0.04, m.y - 0.025);
        o.position.set(m.x, 0, m.z);
        o.userData.b.scale.set(0.15, hh - 0.02, 0.22); o.userData.b.position.y = (hh - 0.02) / 2;
        o.userData.h.scale.set(0.15, 0.02, 0.22); o.userData.h.position.y = hh - 0.01;
      } else if (q.t === "tapis") {
        const o = this.objet("tapis", () => { const m = new THREE.Mesh(BOITE, MAT_DECOR.tapis); m.receiveShadow = true; m.userData.horsCadre = true; return m; });
        const a = C.point("bassin"), b = C.point("teteCentre"), dx = b.x - a.x, dz = b.z - a.z;
        const lg = Math.hypot(dx, dz) > 0.25 ? Math.atan2(dx, dz) : 0;
        o.scale.set(0.66, 0.008, 1.85); o.position.set((a.x + b.x) / 2, 0.004, (a.z + b.z) / 2); o.rotation.set(0, lg, 0);
      } else if (q.t === "mur" || q.t === "murFace") {
        const o = this.objet(q.t, () => {
          const g = new THREE.Group();
          const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.6), MAT_DECOR.mur); m.position.y = 1.3; m.receiveShadow = true; g.add(m);
          const pl = new THREE.Mesh(BOITE, MAT_DECOR.plinthe); pl.scale.set(4.5, 0.08, 0.02); pl.position.y = 0.04; g.add(pl);
          g.userData.horsCadre = true; return g;
        });
        if (q.t === "mur") {
          // Le mur contre l'arrière des jambes levées
          const z = Math.max(C.point("mollet" + "G").z, C.point("molletD").z, C.point("genouArriereG").z, C.point("genouArriereD").z) + 0.035;
          o.position.set(C.point("bassin").x, 0, z); o.rotation.set(0, Math.PI, 0);
        } else {
          const z = Math.max(C.point("mainG").z, C.point("mainD").z) + 0.03;
          o.position.set(0, 0, z); o.rotation.set(0, Math.PI, 0);
        }
      } else if (q.t === "chaise") {
        const o = this.objet("chaise", () => {
          const g = new THREE.Group(), M = MAT_DECOR.bois;
          const add = (sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(BOITE, M); b.scale.set(sx, sy, sz); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); };
          add(0.44, 0.035, 0.42, 0, 0.46, 0.22);
          for (const x of [-0.19, 0.19]) for (const z of [0.03, 0.41]) add(0.035, 0.46, 0.035, x, 0.23, z);
          for (const x of [-0.19, 0.19]) add(0.035, 0.44, 0.035, x, 0.68, 0.02);
          add(0.44, 0.07, 0.03, 0, 0.88, 0.02);
          return g;
        });
        const mg = C.point("mainG"), md = C.point("mainD");
        const y = (mg.y + md.y) / 2 - 0.025, k = y / 0.915;
        o.scale.set(1, k, 1);
        o.position.set((mg.x + md.x) / 2, 0, (mg.z + md.z) / 2 - 0.02 * k);
      } else if (q.t === "banc") {
        const o = this.objet("banc", () => {
          const g = new THREE.Group();
          const t = new THREE.Mesh(BOITE, MAT_DECOR.banc); t.castShadow = t.receiveShadow = true; g.add(t); g.userData.t = t;
          for (const x of [-0.45, 0.45]) { const pied = new THREE.Mesh(BOITE, MAT_DECOR.banc); pied.castShadow = true; pied.userData.x = x; g.add(pied); }
          return g;
        });
        const m = C.point(q.sous), h = Math.max(0.1, C.contact(q.sous));
        o.position.set(m.x + (m.x > 0 ? 0.25 : -0.25), 0, m.z);
        o.userData.t.scale.set(1.1, 0.06, 0.42); o.userData.t.position.y = h - 0.03;
        o.children.forEach((c) => { if (c !== o.userData.t) { c.scale.set(0.06, h - 0.06, 0.36); c.position.set(c.userData.x, (h - 0.06) / 2, 0); } });
      } else if (q.t === "coussin") {
        const o = this.objet("coussin", () => { const m = new THREE.Mesh(SPHERE, MAT_DECOR.coussin); m.castShadow = true; return m; });
        const a = C.point(q.entre[0]), b = C.point(q.entre[1]), ec = a.distanceTo(b);
        o.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        const lx = Math.max(0.03, ec / 2 - 0.045);
        o.scale.set(lx, 0.07 + 0.025 * (q.serre || 0), 0.085);
        o.lookAt(b); o.rotateY(Math.PI / 2);
      } else if (q.t === "serviette" || q.t === "genouillere") {
        const o = this.objet(q.t + (n[q.t]++), () => { const m = new THREE.Mesh(BOITE, q.t === "serviette" ? MAT_DECOR.serviette : MAT_DECOR.genouillere); m.receiveShadow = true; m.userData.horsCadre = true; return m; });
        const m = C.point(q.sous);
        if (q.t === "serviette") { o.scale.set(0.3, 0.012, 0.42); o.position.set(m.x, 0.006, m.z + 0.06); }
        else { o.scale.set(0.2, 0.03, 0.24); o.position.set(m.x, 0.015, m.z); }
      }
    });
    for (const k in this.objets) if (!this.objets[k].userData.vu) this.objets[k].visible = false;
  }
  detruire() {
    if (this.ro) this.ro.disconnect();
    if (this.controls) this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}

// ---------- Vignettes : une seule scène hors écran, rendue en image ----------
let photographe = null;
const VIGNETTES = new Map();
export function vignette(pose, cle, l, h) {
  l = l || 240; h = h || 172;
  const k = cle + "|" + l + "x" + h;
  if (VIGNETTES.has(k)) return VIGNETTES.get(k);
  if (!photographe) photographe = new Scene(null, { capture: true, serre: 0.92 });
  photographe.redimensionner(l, h);
  photographe.cleVue = null;
  photographe.dessiner(pose);
  const url = photographe.renderer.domElement.toDataURL("image/png");
  VIGNETTES.set(k, url);
  return url;
}

export function disponible() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
  catch (e) { return false; }
}
