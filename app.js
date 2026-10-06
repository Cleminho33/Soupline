// Soupline · l'application : accueil du soir, séance guidée, mesure de l'angle, progrès.
// Règles de conception (voir README) : rien à rattraper, aucune série à tenir,
// la plus petite séance compte comme les autres, et le côté gauche passe toujours en douceur.
(function () {
  "use strict";

  var F = FIG, P = PROG;
  var CLE = "soupline-v1";
  var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  // ---------- Outils ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function aujourdHui() { return P.iso(new Date()); }
  function dateCourte(j) { var p = j.split("-"); return +p[2] + " " + MOIS[+p[1] - 1]; }
  function dureeTxt(sec) { var m = Math.round(sec / 60); return (m < 1 ? 1 : m) + " min"; }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
  function borne(x, a, b) { return x < a ? a : x > b ? b : x; }
  var NS = "http://www.w3.org/2000/svg";
  function svgEl(cls) { var s = document.createElementNS(NS, "svg"); if (cls) s.setAttribute("class", cls); return s; }

  var toastMinuteur = 0;
  function toast(t) {
    var el = $("#toast");
    el.textContent = t; el.classList.add("vu");
    clearTimeout(toastMinuteur);
    toastMinuteur = setTimeout(function () { el.classList.remove("vu"); }, 2600);
  }

  // ---------- Données (sur le téléphone uniquement) ----------
  function completer(o) {
    o = o || {};
    o.v = 1;
    o.seances = o.seances || [];
    o.mesures = o.mesures || [];
    o.reglages = Object.assign({ voix: true, sons: true }, o.reglages || {});
    o.debut = o.debut || aujourdHui();
    o.vus = o.vus || {};
    o.dernierChoix = o.dernierChoix || null;
    return o;
  }
  function charger() {
    try { var t = localStorage.getItem(CLE); if (t) return completer(JSON.parse(t)); } catch (e) { /* stockage indisponible */ }
    return completer({});
  }
  var etat = charger();
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); }
    catch (e) { toast("Impossible d'enregistrer sur cet appareil."); }
  }

  // Les photos de mesure vivent dans IndexedDB, trop lourdes pour le reste
  var PHOTOS = (function () {
    var p = null;
    function ouvrir() {
      if (p) return p;
      p = new Promise(function (ok, ko) {
        try {
          var r = indexedDB.open("soupline", 1);
          r.onupgradeneeded = function () { r.result.createObjectStore("photos"); };
          r.onsuccess = function () { ok(r.result); };
          r.onerror = function () { ko(r.error); };
        } catch (e) { ko(e); }
      });
      return p;
    }
    function tx(mode, fn) {
      return ouvrir().then(function (db) {
        return new Promise(function (ok, ko) {
          var t = db.transaction("photos", mode), req = fn(t.objectStore("photos"));
          t.oncomplete = function () { ok(req ? req.result : undefined); };
          t.onerror = function () { ko(t.error); };
        });
      });
    }
    return {
      mettre: function (id, v) { return tx("readwrite", function (s) { return s.put(v, id); }); },
      lire: function (id) { return tx("readonly", function (s) { return s.get(id); }); },
      enlever: function (id) { return tx("readwrite", function (s) { return s.delete(id); }); },
      toutes: function () {
        return ouvrir().then(function (db) {
          return new Promise(function (ok, ko) {
            var out = {}, t = db.transaction("photos", "readonly"), req = t.objectStore("photos").openCursor();
            req.onsuccess = function () { var c = req.result; if (c) { out[c.key] = c.value; c.continue(); } };
            t.oncomplete = function () { ok(out); };
            t.onerror = function () { ko(t.error); };
          });
        });
      },
      vider: function () { return tx("readwrite", function (s) { return s.clear(); }); }
    };
  })();

  // ---------- Calculs ----------
  function totalMinutes() { return etat.seances.reduce(function (t, s) { return t + (s.min || 0); }, 0); }
  function mesuresTriees() { return etat.mesures.slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }); }
  function derniereMesure() { var m = mesuresTriees(); return m.length ? m[m.length - 1] : null; }
  function angleCourant() { var m = derniereMesure(); return m ? m.angle : null; }
  function phaseCourante() { return P.phase(totalMinutes()); }
  function seancesDuJour() { var j = aujourdHui(); return etat.seances.filter(function (s) { return s.d === j; }); }
  function ctxSeance(prudence) { return P.reglages(angleCourant() || 80, prudence, phaseCourante().n); }

  // ---------- Voix et sons ----------
  var VOIX = (function () {
    var synth = window.speechSynthesis, voix = null;
    function choisir() {
      if (!synth) return;
      var vs = synth.getVoices() || [], fr = vs.filter(function (v) { return /^fr[-_]FR/i.test(v.lang); });
      var pref = ["Thomas", "Amélie", "Audrey", "Aurélie", "Marie", "Google français", "Microsoft Denise", "Microsoft Henri"];
      voix = null;
      pref.some(function (n) { var t = fr.filter(function (v) { return v.name.indexOf(n) >= 0; })[0]; if (t) { voix = t; return true; } return false; });
      if (!voix) voix = fr[0] || vs.filter(function (v) { return /^fr/i.test(v.lang); })[0] || null;
    }
    if (synth) { choisir(); if ("onvoiceschanged" in synth) synth.onvoiceschanged = choisir; }
    return {
      dire: function (t) {
        if (!synth || !etat.reglages.voix || !t) return;
        try {
          synth.cancel();
          var u = new SpeechSynthesisUtterance(t);
          u.lang = "fr-FR"; if (voix) u.voice = voix; u.rate = 0.97; u.pitch = 1;
          synth.speak(u);
        } catch (e) { /* voix indisponible */ }
      },
      debloquer: function () {
        if (!synth) return;
        try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* rien */ }
      },
      couper: function () { try { if (synth) synth.cancel(); } catch (e) { /* rien */ } }
    };
  })();

  var SON = (function () {
    var ctx = null;
    function ac() {
      try {
        if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); }
        if (ctx && ctx.state === "suspended") ctx.resume();
      } catch (e) { ctx = null; }
      return ctx;
    }
    function note(f1, f2, dur, vol, type) {
      if (!etat.reglages.sons) return;
      var c = ac(); if (!c) return;
      try {
        var o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
        o.type = type || "sine";
        o.frequency.setValueAtTime(f1, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t); o.stop(t + dur + 0.05);
      } catch (e) { /* audio indisponible */ }
    }
    return {
      debloquer: ac,
      cloche: function () { note(784, null, 1.1, 0.07); note(1176, null, 0.7, 0.025); },
      inspire: function () { note(262, 349, 1.6, 0.03); },
      expire: function () { note(349, 233, 2.2, 0.025); },
      tic: function () { note(1320, null, 0.09, 0.03, "triangle"); },
      fin: function () { note(523, null, 1.4, 0.05); setTimeout(function () { note(659, null, 1.3, 0.045); }, 140); setTimeout(function () { note(784, null, 1.6, 0.05); }, 280); }
    };
  })();

  var verrou = null;
  function garderEcran() {
    try { if (navigator.wakeLock && !verrou) navigator.wakeLock.request("screen").then(function (v) { verrou = v; v.addEventListener("release", function () { verrou = null; }); }).catch(function () { /* refusé */ }); }
    catch (e) { /* non pris en charge */ }
  }
  function lacherEcran() { try { if (verrou) verrou.release(); } catch (e) { /* rien */ } verrou = null; }

  // ---------- Petites icônes ----------
  var ICO = {
    match: '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18V8h18v10"/><path d="M3 12h18M8 8v10M13 8v10M18 8v10" opacity=".45"/><circle cx="12" cy="20" r="2" fill="#FFB547" stroke="none"/></svg>',
    veille: '<svg viewBox="0 0 24 24" fill="none" stroke="#8C7BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/><path d="M17 3v3M15.5 4.5h3"/></svg>',
    lendemain: '<svg viewBox="0 0 24 24" fill="none" stroke="#5EE0C8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
    jeudi: '<svg viewBox="0 0 24 24" fill="none" stroke="#8C7BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/></svg>',
    entrainement: '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/></svg>',
    libre: '<svg viewBox="0 0 24 24" fill="none" stroke="#8C7BFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/></svg>',
    coche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.5"/></svg>',
    hp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    hpOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    lecture: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
    fermer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function pile(n) {
    var c = n === 1 ? "#FF7A6B" : n === 2 ? "#FFB547" : "#5EE0C8", r = "";
    for (var i = 0; i < 3; i++) r += '<rect class="' + (i < n ? "pile" : "") + '" x="' + (5 + i * 10.5) + '" y="5" width="8.5" height="16" rx="2" fill="' + (i < n ? c : "rgba(255,255,255,.1)") + '"/>';
    return '<svg viewBox="0 0 44 26" aria-hidden="true"><rect x="1.5" y="1.5" width="37" height="23" rx="5" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/><rect x="39" y="9" width="3.5" height="8" rx="1.5" fill="rgba(255,255,255,.35)"/>' + r + "</svg>";
  }

  // Vignette d'un exercice : la position figée à son moment le plus parlant
  function vignette(svg, exoId) {
    var X = P.EXOS[exoId];
    new F.Scene(svg).dessiner(F.POSES[X.pose](X.vig, 0.5));
    return svg;
  }
  var VIG_SEANCE = { plancher: "murV", plancherPlus: "papillonAllonge", calme: "rockback", standard: "ecart", pleine: "cosaque",
    avantMatch: "balancier", redescente: "papillonAllonge", redescenteCourte: "murV", douleur: "squeeze", fitness: "soupir" };

  // =====================================================================
  // ACCUEIL
  // =====================================================================
  var heros = { raf: 0 };
  function rendreAccueil() {
    var v = $("#v-accueil"), ctx = P.contexte(new Date()), mesure = derniereMesure();
    var angle = mesure ? mesure.angle : 80, pal = P.palierSuivant(angle), faits = seancesDuJour();
    var ph = phaseCourante(), tot = totalMinutes();
    var h = "";

    // Ton écart
    h += '<div class="carte heros apparait" style="--i:0">' +
      '<div class="heros-tete"><span class="etiquette">Ton écart</span><button class="lien" id="b-mesurer">' + (mesure ? "Nouvelle mesure" : "Mesurer mon point zéro") + "</button></div>" +
      '<div class="heros-corps"><div class="heros-chiffre"><b id="h-angle">0</b><span class="deg">°</span>' +
      "<small>" + (mesure ? "mesuré le " + dateCourte(mesure.d) : "estimation de départ, à mesurer") + "</small></div>" +
      '<svg class="heros-svg" id="h-svg" role="img" aria-label="Ton écart actuel, ' + angle + ' degrés"></svg></div>';
    if (pal) {
      h += '<div class="palier"><span class="pastille"></span><span>Prochain palier : <b>' + pal.a + "° · " + esc(pal.nom) + '</b></span><span class="reste">encore ' + (pal.a - angle) + "°</span></div>";
    } else {
      h += '<div class="palier"><span class="pastille"></span><span><b>À plat.</b> Le travail devient de l\'entretien.</span></div>';
    }
    h += '<div class="jauge" id="h-jauge"><div class="jauge-pleine"></div>' +
      P.PALIERS.map(function (q) { return '<i style="left:' + (q.a / 180 * 100) + '%"></i>'; }).join("") + "</div>" +
      '<div class="jauge-legende"><span>0°</span><span>90°</span><span>180°</span></div></div>';

    // Ce soir
    var heure = new Date().getHours(), coach;
    var derniere = etat.seances.length ? etat.seances[etat.seances.length - 1] : null;
    var ecart = derniere ? Math.round((Date.parse(aujourdHui()) - Date.parse(derniere.d)) / 864e5) : null;
    if (!etat.seances.length) coach = "Premier soir : trois minutes, allongé. Ridiculement petit ? C'est voulu.";
    else if (faits.length) coach = "C'est fait. Rien d'autre à faire ce soir.";
    else if (ecart !== null && ecart >= 4) coach = "On reprend où tu en es. Rien à rattraper.";
    else if (heure >= 20) coach = "Trois minutes suffisent pour que ce soir compte.";
    else coach = "Vers 21h, après les filles : ta séance t'attend.";
    h += '<div class="carte apparait" style="--i:1"><div class="soir-tete"><span class="soir-icone">' + (ICO[ctx.cle] || ICO.libre) + "</span>" +
      "<div><b>" + esc(ctx.titre) + "</b><span>" + esc(ctx.ligne) + "</span></div></div>" +
      '<p class="soir-detail">' + esc(ctx.detail) + "</p>";
    if (faits.length) {
      var minF = faits.reduce(function (t, s) { return t + s.min; }, 0);
      h += '<div class="fait">' + ICO.coche + "<span>Fait ce soir · " + minF + " min · " + esc(faits[faits.length - 1].nom) + "</span></div>";
    }
    h += '<p class="coach">' + esc(coach) + "</p>";
    h += '<div class="duo"><button class="bouton" id="b-seance">' + (faits.length ? "Encore un peu ?" : "Lancer ma séance") + "</button>";
    if (ctx.cle === "match") h += '<button class="bouton secondaire" id="b-avant">Avant-match · ' + dureeTxt(P.construire("avantMatch", ctxSeance(false)).duree) + ', avant l\'échauffement</button>';
    h += "</div></div>";

    // Installer sur l'écran d'accueil (une fois)
    var autonome = window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    if (!autonome && !etat.vus.installer) {
      h += '<div class="carte apparait installer" style="--i:2"><div><b>Sur ton écran d\'accueil</b><p>Dans Safari : Partager, puis « Sur l\'écran d\'accueil ». Plein écran, et l\'app se lance comme les autres.</p></div>' +
        '<button class="rond" id="b-installer-ok" aria-label="Masquer">' + ICO.fermer + "</button></div>";
    }

    // La saison
    var pct = ph.a ? Math.min(100, (tot - ph.de) / (ph.a - ph.de) * 100) : 100;
    h += '<div class="carte apparait" style="--i:3"><div class="ligne-titre"><span class="etiquette">Phase ' + ph.n + " · " + esc(ph.nom) + "</span>" +
      '<span class="doux" style="font-size:13px">' + (ph.a ? tot + " / " + ph.a + " min" : tot + " min") + "</span></div>" +
      '<div class="barre"><div id="s-barre"></div></div><p class="doux" style="font-size:14.5px">' + esc(ph.texte) + "</p>" +
      '<div class="stats"><div><b>' + etat.seances.length + "</b><span>séances</span></div><div><b>" + tot + "</b><span>minutes</span></div><div><b>" + etat.mesures.length + "</b><span>mesures</span></div></div>" +
      '<p class="mini">Rien ne se perd : chaque minute fait avancer la phase, même les soirs à plat.</p></div>';

    // Autres séances
    var autres = [
      ["plancher", "Plancher", "Même à plat, ça compte"],
      ["redescente", "Redescente", "Après un match ou une journée lourde"],
      ["avantMatch", "Avant-match", "Dynamique, avant l'échauffement"],
      ["fitness", "Joker Fitness+", "Un Yoga de 10 ou 20 min compte"]
    ];
    h += '<div class="carte apparait" style="--i:4"><span class="etiquette">Autres séances</span><div class="liste">' +
      autres.map(function (a) {
        var d = a[0] === "fitness" ? "joker" : dureeTxt(P.construire(a[0], ctxSeance(false)).duree);
        return '<button class="rangee" data-lancer="' + a[0] + '"><svg class="vig" data-vig="' + VIG_SEANCE[a[0]] + '"></svg><div><b>' + a[1] + "</b><span>" + a[2] + '</span></div><span class="duree">' + d + "</span></button>";
      }).join("") + "</div></div>";

    v.innerHTML = h;
    $$("svg[data-vig]", v).forEach(function (s) { vignette(s, s.getAttribute("data-vig")); });
    animerHeros($("#h-svg"), angle, pal);
    requestAnimationFrame(function () {
      var j = $("#h-jauge .jauge-pleine"); if (j) j.style.width = (angle / 180 * 100) + "%";
      var b = $("#s-barre"); if (b) b.style.width = pct + "%";
    });

    $("#b-seance").onclick = function () { ouvrirChoix(); };
    if ($("#b-avant")) $("#b-avant").onclick = function () { lancer("avantMatch", { energie: "normal", adducteur: "ok" }); };
    $("#b-mesurer").onclick = ouvrirMesure;
    if ($("#b-installer-ok")) $("#b-installer-ok").onclick = function () { etat.vus.installer = 1; sauver(); rendreAccueil(); };
    $$("[data-lancer]", v).forEach(function (b) {
      b.onclick = function () {
        var c = b.getAttribute("data-lancer");
        if (c === "fitness") ouvrirJoker(); else lancer(c, { energie: "normal", adducteur: "ok" });
      };
    });
  }

  // Le bonhomme du héros s'ouvre jusqu'à ton angle, puis respire. Fantôme du prochain palier en pointillés.
  function animerHeros(svg, angle, pal) {
    cancelAnimationFrame(heros.raf);
    if (!svg) return;
    var scene = new F.Scene(svg), debut = performance.now(), chiffre = $("#h-angle");
    var arc = document.createElementNS(NS, "path"), fantome = document.createElementNS(NS, "path");
    fantome.setAttribute("fill", "none"); fantome.setAttribute("stroke", "#FFB547"); fantome.setAttribute("stroke-width", "2.5");
    fantome.setAttribute("stroke-dasharray", "3 7"); fantome.setAttribute("stroke-linecap", "round"); fantome.setAttribute("opacity", "0");
    arc.setAttribute("fill", "rgba(255,181,71,.16)"); arc.setAttribute("stroke", "#FFB547"); arc.setAttribute("stroke-width", "2");
    svg.insertBefore(fantome, svg.firstChild.nextSibling);
    svg.appendChild(arc);
    function geo(a) {
      var th = a / 2 * Math.PI / 180, by = F.SOL - F.JAMBE * Math.cos(th), dx = F.L.hanche + F.JAMBE * Math.sin(th);
      return { by: by, dx: dx, th: th };
    }
    var gp = pal ? geo(pal.a) : null;
    if (gp) fantome.setAttribute("d", "M" + (180 - F.L.hanche) + " " + gp.by + " L" + (180 - gp.dx) + " " + F.SOL + " M" + (180 + F.L.hanche) + " " + gp.by + " L" + (180 + gp.dx) + " " + F.SOL);
    function tick(now) {
      if (!document.body.contains(svg)) return;
      var t = (now - debut) / 1000, ouv = F.douce(Math.min(1, t / 1.8));
      var a = 24 + (angle - 24) * ouv, s = 0.5 + 0.5 * Math.sin(t * Math.PI / 3);
      scene.dessiner(F.POSES.ecart({ angle: a, bras: "etoile", decor: "", zones: true }, s));
      var g = geo(a), r = 30, cx = 180, cy = g.by + 6;
      var x1 = cx - r * Math.sin(g.th), y1 = cy + r * Math.cos(g.th), x2 = cx + r * Math.sin(g.th);
      arc.setAttribute("d", "M" + cx + " " + cy + " L" + x1.toFixed(1) + " " + y1.toFixed(1) + " A" + r + " " + r + " 0 0 0 " + x2.toFixed(1) + " " + y1.toFixed(1) + " Z");
      if (chiffre) chiffre.textContent = Math.round(a > angle - 0.5 ? angle : a);
      fantome.setAttribute("opacity", (0.55 * F.douce((t - 1.6) / 0.8)).toFixed(2));
      if (!$("#lecteur").classList.contains("ouvert") && $("#v-accueil").classList.contains("active")) heros.raf = requestAnimationFrame(tick);
      else heros.raf = 0;
    }
    heros.raf = requestAnimationFrame(tick);
  }
  function relancerHeros() {
    if (heros.raf || !$("#v-accueil").classList.contains("active")) return;
    var m = derniereMesure(), a = m ? m.angle : 80;
    var svg = $("#h-svg"); if (!svg) return;
    svg.innerHTML = "";
    animerHeros(svg, a, P.palierSuivant(a));
  }

  // =====================================================================
  // CHOIX DE LA SÉANCE (feuille)
  // =====================================================================
  var choix = { energie: "normal", adducteur: "ok" };
  function ouvrirFeuille(html) {
    var f = $("#feuille");
    f.innerHTML = '<div class="poignee"></div>' + html;
    $("#voile").classList.add("ouvert");
    requestAnimationFrame(function () { f.classList.add("ouverte"); });
    $("#voile").onclick = fermerFeuille;
    return f;
  }
  function fermerFeuille() { $("#feuille").classList.remove("ouverte"); $("#voile").classList.remove("ouvert"); }

  function ouvrirChoix() {
    var ctx = P.contexte(new Date());
    choix.energie = !etat.seances.length ? "plat" : (etat.dernierChoix || "normal");
    choix.adducteur = "ok";
    var f = ouvrirFeuille(
      '<h2 id="f-titre">Ce soir, t\'es comment ?</h2><p class="doux">' + esc(ctx.titre) + " · " + esc(ctx.ligne) + "</p>" +
      '<div class="energies" role="radiogroup" aria-label="Énergie">' +
      [["plat", "À plat", 1], ["normal", "Normal", 2], ["forme", "En forme", 3]].map(function (e) {
        return '<button class="energie" role="radio" data-e="' + e[0] + '">' + pile(e[2]) + "<b>" + e[1] + '</b><span data-duree="' + e[0] + '"></span></button>';
      }).join("") + "</div>" +
      '<div class="bloc-add"><span>Ton adducteur gauche</span><div class="segmente" role="radiogroup">' +
      '<button data-a="ok">Tranquille</button><button data-a="sent">Se fait sentir</button><button data-a="douleur">Douloureux</button></div>' +
      '<p class="note" id="f-note"></p></div>' +
      '<div class="apercu" id="f-apercu"></div>' +
      '<button class="bouton" id="f-go"></button>' +
      '<p class="mini" style="text-align:center">Ta WHOOP est dans le rouge ? Prends « À plat », ça compte pareil.</p>');
    $$(".energie", f).forEach(function (b) { b.onclick = function () { choix.energie = b.getAttribute("data-e"); majChoix(); }; });
    $$(".segmente button", f).forEach(function (b) { b.onclick = function () { choix.adducteur = b.getAttribute("data-a"); majChoix(); }; });
    $("#f-go").onclick = function () {
      etat.dernierChoix = choix.energie; sauver();
      fermerFeuille();
      lancer(P.choisir(ctx.cle, choix.energie, choix.adducteur), { energie: choix.energie, adducteur: choix.adducteur });
    };
    majChoix();
  }
  function majChoix() {
    var f = $("#feuille"), ctx = P.contexte(new Date()), prudence = choix.adducteur === "sent";
    $$(".energie", f).forEach(function (b) {
      var e = b.getAttribute("data-e"), on = e === choix.energie;
      b.classList.toggle("choisie", on); b.setAttribute("aria-checked", on);
      var s = P.construire(P.choisir(ctx.cle, e, choix.adducteur), ctxSeance(prudence));
      $("[data-duree]", b).textContent = dureeTxt(s.duree);
    });
    $$(".segmente button", f).forEach(function (b) { b.classList.toggle("choisi", b.getAttribute("data-a") === choix.adducteur); });
    var notes = {
      ok: "",
      sent: "Mode prudence : côté gauche moins loin, contractions à 20 ou 30 %, et toujours en second.",
      douleur: "Ce soir on ne sollicite pas l'aine : respiration, coussin très doux, jambes au mur serrées. Si ça dure plus de quelques jours ou que ça gêne pour marcher, un kiné."
    };
    $("#f-note").textContent = notes[choix.adducteur];
    var cle = P.choisir(ctx.cle, choix.energie, choix.adducteur), s = P.construire(cle, ctxSeance(prudence));
    var ap = $("#f-apercu");
    ap.innerHTML = '<div class="apercu-tete"><b>' + esc(s.nom) + "</b><span>" + dureeTxt(s.duree) + "</span></div><p>" + esc(s.sous) +
      (!etat.seances.length && choix.energie === "plat" ? " Parfait pour un premier soir." : "") + '</p><div class="etapes">' +
      s.etapes.map(function (e) {
        return '<div class="etape"><svg data-vig="' + e.id + '"></svg><b>' + esc(e.nom) + "</b><span>" + dureeTxt(e.duree) + "</span></div>";
      }).join("") + "</div>";
    $$("svg[data-vig]", ap).forEach(function (sv) { vignette(sv, sv.getAttribute("data-vig")); });
    $("#f-go").textContent = "C'est parti · " + dureeTxt(s.duree);
  }

  function ouvrirJoker() {
    var f = ouvrirFeuille('<h2 id="f-titre">Joker Fitness+</h2><p class="doux">Un Yoga, un Pilates ou un retour au calme fait dans Fitness+ ce soir compte comme une séance.</p>' +
      '<div class="energies">' + [10, 20, 30].map(function (m) { return '<button class="energie" data-m="' + m + '"><b style="font-size:22px">' + m + "</b><span>minutes</span></button>"; }).join("") + "</div>" +
      '<p class="mini" style="text-align:center">Rien ne remplace le mur en V pour le grand écart, mais ça entretient.</p>');
    $$("[data-m]", f).forEach(function (b) {
      b.onclick = function () {
        var m = +b.getAttribute("data-m");
        noter({ cle: "fitness", nom: "Joker Fitness+", min: m, sec: m * 60, complet: true });
        fermerFeuille(); rendreTout(); toast("Noté : " + m + " min. Ça compte.");
      };
    });
  }

  // =====================================================================
  // LECTEUR DE SÉANCE
  // =====================================================================
  var VUES = { squeeze: "Vu du dessus", papillonAllonge: "Vu du dessus", grenouille: "Vu de dos", rockback: "Vu de dos", balancier: "Vu de dos", murV: "Vu depuis ta tête" };
  var LEC = { en: false };

  function lancer(cle, opts) {
    var prudence = opts.adducteur === "sent";
    var s = P.construire(cle, ctxSeance(prudence)), acc = 0;
    s.debuts = s.segments.map(function (g) { var d = acc; acc += g.d; return d; });
    s.etapes.forEach(function (e) { e.t0 = s.debuts[e.debut]; });
    LEC = { en: true, pause: false, s: s, cle: cle, opts: opts, i: 0, t: 0, fait: 0, souffleT: 0, phaseSouffle: null, etape: -1, last: 0, raf: 0, compte: 3 };
    var svg = $("#l-svg"); svg.innerHTML = "";
    LEC.scene = new F.Scene(svg);
    $("#l-seance").textContent = s.nom;
    $("#l-barre").innerHTML = s.etapes.map(function (e) { return '<i style="flex:' + e.duree.toFixed(1) + '"></i>'; }).join("");
    majVoixBouton();
    $("#l-pause").innerHTML = ICO.pause;
    $("#lecteur").classList.add("ouvert");
    VOIX.debloquer(); SON.debloquer(); garderEcran();
    entrer(0, true);
    dessinerLecteur();
    // Compte à rebours, puis c'est parti
    var c = $("#l-compte"), n = 3;
    function etape() {
      if (!LEC.en) { c.innerHTML = ""; return; }
      if (n === 0) { c.innerHTML = ""; LEC.compte = 0; entrer(0); LEC.last = performance.now(); LEC.raf = requestAnimationFrame(boucle); return; }
      c.innerHTML = "<span>" + n + "</span>"; SON.tic(); n--; setTimeout(etape, 900);
    }
    etape();
  }

  function entrer(i, silencieux) {
    var g = LEC.s.segments[i], X = P.EXOS[g.exo], prec = LEC.s.segments[i - 1];
    if (g.etape !== LEC.etape) {
      LEC.etape = g.etape;
      var h = $("#l-nom"); h.textContent = X.nom; h.classList.remove("change"); void h.offsetWidth; h.classList.add("change");
      $("#l-vue").textContent = VUES[X.pose] || "";
    }
    var puce = $("#l-cote");
    puce.textContent = g.nomCote ? g.nomCote + (g.cote === "G" && LEC.opts.adducteur === "sent" ? " · en douceur" : "") : "";
    puce.classList.toggle("doux-g", g.cote === "G");
    $("#l-consigne").textContent = g.type === "prep" ? X.consignes[0] : X.consignes[1];
    $("#lecteur").setAttribute("data-type", g.type || (g.souffle || g.sp ? "souffle" : "mouvement"));
    if (g.souffle && !(prec && prec.souffle)) { LEC.souffleT = 0; LEC.phaseSouffle = null; }
    if (silencieux) return;
    if (g.type === "prep") SON.cloche();
    if (g.son === "inspire") SON.inspire();
    if (g.son === "expire") SON.expire();
    if (g.voix) VOIX.dire(g.voix);
  }

  function boucle(now) {
    if (!LEC.en) return;
    var dt = Math.min(0.1, (now - LEC.last) / 1000);
    LEC.last = now;
    if (!LEC.pause) {
      LEC.t += dt; LEC.fait += dt; LEC.souffleT += dt;
      var g = LEC.s.segments[LEC.i];
      while (LEC.t >= g.d) {
        LEC.t -= g.d; LEC.i++;
        if (LEC.i >= LEC.s.segments.length) { terminer(true); return; }
        g = LEC.s.segments[LEC.i]; entrer(LEC.i);
      }
    }
    dessinerLecteur();
    LEC.raf = requestAnimationFrame(boucle);
  }

  function dessinerLecteur() {
    var g = LEC.s.segments[LEC.i], u = g.d ? Math.min(1, LEC.t / g.d) : 1;
    var p = F.melange(g.de, g.a || g.de, F.douce(u)), s, lab = null;
    if (g.sp) s = p.s;
    else if (g.souffle) {
      var c = LEC.souffleT % 10, ph = c < 4 ? "in" : "out";
      s = c < 4 ? F.douce(c / 4) : 1 - F.douce((c - 4) / 6);
      lab = c < 4 ? "Inspire" : "Expire";
      if (ph !== LEC.phaseSouffle) {
        if (LEC.phaseSouffle !== null && !LEC.pause) { if (ph === "in") SON.inspire(); else SON.expire(); }
        LEC.phaseSouffle = ph;
      }
    } else { s = 0.4 + 0.08 * Math.sin(LEC.fait * 1.4); LEC.phaseSouffle = null; }
    LEC.scene.dessiner(F.POSES[g.pose](p, s));

    // Anneau : progression du moment, bulle qui respire
    $("#l-arc").setAttribute("stroke-dashoffset", (339.3 * (1 - u)).toFixed(1));
    var bulle = $("#l-bulle");
    bulle.setAttribute("r", (g.souffle || g.sp ? 30 + 20 * s : 40).toFixed(1));
    var label = LEC.compte > 0 ? "Prêt ?" : (g.label || lab || "");
    var restant = g.d - LEC.t, sous = g.d >= 6 ? Math.ceil(restant) + " s" : (g.rep || "");
    if (g.d >= 6 && g.rep) sous = g.rep + " · " + Math.ceil(restant) + " s";
    if ($("#l-label").textContent !== label) $("#l-label").textContent = label;
    if ($("#l-sous").textContent !== sous) $("#l-sous").textContent = sous;

    // Barre de la séance et temps restant
    var ecoule = LEC.s.debuts[LEC.i] + LEC.t;
    $$("#l-barre i").forEach(function (b, n) {
      var e = LEC.s.etapes[n];
      b.style.setProperty("--p", borne((ecoule - e.t0) / e.duree, 0, 1).toFixed(3));
    });
    var reste = mmss(LEC.s.duree - ecoule) + " restantes";
    if ($("#l-reste").textContent !== reste) $("#l-reste").textContent = reste;
  }

  function allerEtape(n) {
    if (n < 0) n = 0;
    if (n >= LEC.s.etapes.length) { terminer(true); return; }
    LEC.i = LEC.s.etapes[n].debut; LEC.t = 0; LEC.etape = -1;
    entrer(LEC.i);
    dessinerLecteur();
  }
  function basculerPause() {
    if (!LEC.en || LEC.compte > 0) return;
    LEC.pause = !LEC.pause;
    $("#l-pause").innerHTML = LEC.pause ? ICO.lecture : ICO.pause;
    $("#l-pause").setAttribute("aria-label", LEC.pause ? "Reprendre" : "Pause");
    if (LEC.pause) { VOIX.couper(); lacherEcran(); $("#l-label").textContent = "En pause"; }
    else { garderEcran(); LEC.last = performance.now(); }
  }
  function majVoixBouton() {
    var b = $("#l-voix");
    b.innerHTML = etat.reglages.voix ? ICO.hp : ICO.hpOff;
    b.setAttribute("aria-label", etat.reglages.voix ? "Couper la voix" : "Activer la voix");
  }

  function noter(o) {
    var d = new Date();
    etat.seances.push({
      d: aujourdHui(), h: String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"),
      cle: o.cle, nom: o.nom, min: Math.max(1, o.min), sec: o.sec || 0, complet: !!o.complet, add: o.add || "ok"
    });
    sauver();
  }

  function terminer(complet) {
    if (!LEC.en) return;
    LEC.en = false;
    cancelAnimationFrame(LEC.raf);
    VOIX.couper(); lacherEcran();
    var sec = LEC.fait, min = Math.max(1, Math.round(sec / 60));
    var avant = totalMinutes();
    noter({ cle: LEC.cle, nom: LEC.s.nom, min: min, sec: Math.round(sec), complet: complet, add: LEC.opts.adducteur });
    if (complet) { SON.fin(); VOIX.dire("C'est fait. Ce soir compte."); }
    $("#lecteur").classList.remove("ouvert");
    afficherFin(complet, min, avant);
  }
  function arreter() {
    if (!LEC.en) return;
    if (LEC.fait < 45) {
      LEC.en = false; cancelAnimationFrame(LEC.raf); VOIX.couper(); lacherEcran();
      $("#lecteur").classList.remove("ouvert"); $("#l-compte").innerHTML = "";
      rendreTout(); return;
    }
    terminer(false);
  }

  // =====================================================================
  // FIN DE SÉANCE
  // =====================================================================
  var PHRASES = [
    "Ton frein a lâché un cran. Ton cerveau s'en souviendra demain.",
    "C'est la régularité qui ouvre, pas l'intensité. Ce soir, tu as fait ta part.",
    "Le système nerveux apprend par répétition. Une répétition de plus, ce soir.",
    "Personne ne voit ce travail-là. Ton poteau gauche, si.",
    "Pas besoin d'en faire plus. Il fallait juste le faire.",
    "Lavé, essoré, assoupli. À demain."
  ];
  function afficherFin(complet, min, avant) {
    var apres = totalMinutes(), phA = P.phase(avant), phB = P.phase(apres);
    var pAv = phB.a ? borne((avant - phB.de) / (phB.a - phB.de) * 100, 0, 100) : 100;
    var pAp = phB.a ? borne((apres - phB.de) / (phB.a - phB.de) * 100, 0, 100) : 100;
    var fin = $("#fin");
    fin.innerHTML = '<div class="plein-int fin-int">' +
      '<svg class="coche" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><path d="M38 62 l16 16 l30 -34"/></svg>' +
      "<h2>" + (complet ? "C'est fait." : "Arrêté. Et ça compte.") + "</h2>" +
      '<p class="fin-min"><b id="fin-compteur">0</b>min ce soir</p>' +
      (phB.n > phA.n ? '<div class="deblocage"><span class="etiquette">Phase débloquée</span><b>Phase ' + phB.n + " · " + esc(phB.nom) + '</b><span class="doux">' + esc(phB.texte) + "</span></div>" : "") +
      '<div class="carte"><div class="ligne-titre"><span class="etiquette">Phase ' + phB.n + " · " + esc(phB.nom) + '</span><span class="doux" style="font-size:13px">' +
      (phB.a ? apres + " / " + phB.a + " min" : apres + " min") + '</span></div><div class="barre"><div id="fin-barre" style="width:' + pAv + '%"></div></div></div>' +
      '<div class="carte"><span class="etiquette">Ton adducteur gauche, pendant la séance ?</span>' +
      '<div class="segmente" style="margin-top:10px"><button data-r="ras">Rien</button><button data-r="peu">Un peu</button><button data-r="tire">Ça a tiré</button></div>' +
      '<p class="note" id="fin-note"></p></div>' +
      '<p class="fin-phrase">' + esc(PHRASES[Math.floor(Math.random() * PHRASES.length)]) + "</p>" +
      '<button class="bouton" id="fin-ok">Terminer</button></div>';
    fin.classList.add("ouvert");
    var n = 0, cpt = $("#fin-compteur"), pas = Math.max(1, Math.round(min / 25));
    var iv = setInterval(function () { n = Math.min(min, n + pas); cpt.textContent = n; if (n >= min) clearInterval(iv); }, 40);
    setTimeout(function () { var b = $("#fin-barre"); if (b) b.style.width = pAp + "%"; }, 500);
    $$("[data-r]", fin).forEach(function (b) {
      b.onclick = function () {
        var r = b.getAttribute("data-r");
        $$("[data-r]", fin).forEach(function (x) { x.classList.toggle("choisi", x === b); });
        var der = etat.seances[etat.seances.length - 1]; if (der) { der.ressenti = r; sauver(); }
        $("#fin-note").textContent = r === "ras" ? "Feu vert. On continue comme ça."
          : r === "peu" ? "Normal si c'est léger. Demain matin, s'il est plus raide qu'avant : « Se fait sentir » au prochain lancement."
          : "Prochaine séance en mode prudence. Si ça tire à chaque fois ou que ça reste douloureux, un kiné.";
      };
    });
    $("#fin-ok").onclick = function () { fin.classList.remove("ouvert"); rendreTout(); };
  }

  // =====================================================================
  // MESURE DE L'ANGLE PAR PHOTO
  // =====================================================================
  var MES = null;
  function ouvrirMesure() {
    var m = $("#mesure");
    m.innerHTML = '<div class="plein-int"><div class="m-tete"><button class="rond" id="m-fermer" aria-label="Fermer">' + ICO.fermer + "</button><h2>Mesurer ton écart</h2></div>" +
      '<div id="m-corps"></div></div>';
    m.classList.add("ouvert");
    $("#m-fermer").onclick = fermerMesure;
    etapeProtocole();
  }
  function fermerMesure() { $("#mesure").classList.remove("ouvert"); MES = null; }
  function etapeProtocole() {
    var c = $("#m-corps");
    c.innerHTML = '<svg class="m-illu" id="m-illu"></svg>' +
      '<ol class="m-protocole">' +
      "<li>Toujours <b>au même endroit</b>, chaussettes sur sol lisse, mains sur un appui.</li>" +
      "<li>Ouvre jusqu'à <b>7 sur 10</b>, pas plus, et tiens 10 secondes.</li>" +
      "<li>Photo <b>de face</b>, téléphone à hauteur de bassin, à 2 ou 3 mètres. Quelqu'un te la prend, ou le téléphone calé avec le minuteur.</li>" +
      "<li>Idéalement à la fin d'une séance : échauffé, pas épuisé. Une mesure toutes les deux semaines suffit.</li></ol>" +
      '<label class="bouton" for="m-fichier">Prendre ou choisir la photo</label><input type="file" accept="image/*" id="m-fichier" hidden>';
    new F.Scene($("#m-illu")).dessiner(F.POSES.ecart({ angle: (angleCourant() || 80) + 4 }, 0.5));
    $("#m-fichier").onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var url = URL.createObjectURL(f), img = new Image();
      img.onload = function () { etapePoints(img, url); };
      img.onerror = function () { toast("Photo illisible, essaie une autre."); };
      img.src = url;
    };
  }
  var CONSIGNES_POINTS = ["Touche le centre de ton bassin, l'entrejambe", "Touche ta cheville droite", "Touche ta cheville gauche", "Ajuste si besoin, puis valide"];
  function etapePoints(img, url) {
    var c = $("#m-corps");
    c.innerHTML = '<div class="m-photo"><canvas id="m-canvas"></canvas></div>' +
      '<p class="m-consigne" id="m-consigne"></p><div class="m-angle" id="m-angle"></div>' +
      '<div class="m-actions"><button class="bouton secondaire" id="m-refaire">Refaire les points</button><button class="bouton" id="m-valider" disabled>Valider</button></div>';
    var cv = $("#m-canvas"), ctx = cv.getContext("2d");
    MES = { img: img, url: url, pts: [], drag: -1 };
    function taille() {
      var w = cv.parentNode.clientWidth, ratio = img.naturalHeight / img.naturalWidth;
      var h = Math.min(w * ratio, window.innerHeight * 0.58); w = h / ratio;
      var dpr = window.devicePixelRatio || 1;
      cv.style.width = w + "px"; cv.style.height = h + "px"; cv.style.margin = "0 auto";
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      MES.echelle = cv.width / img.naturalWidth; MES.dpr = dpr;
      dessiner();
    }
    function angle() {
      var p = MES.pts; if (p.length < 3) return null;
      var a = { x: p[1].x - p[0].x, y: p[1].y - p[0].y }, b = { x: p[2].x - p[0].x, y: p[2].y - p[0].y };
      var cos = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y) || 1);
      return Math.acos(borne(cos, -1, 1)) * 180 / Math.PI;
    }
    function dessiner() {
      var e = MES.echelle, dpr = MES.dpr, p = MES.pts;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      ctx.lineCap = "round";
      if (p.length >= 2) {
        ctx.strokeStyle = "#FFB547"; ctx.lineWidth = 3.5 * dpr;
        for (var i = 1; i < p.length; i++) { ctx.beginPath(); ctx.moveTo(p[0].x * e, p[0].y * e); ctx.lineTo(p[i].x * e, p[i].y * e); ctx.stroke(); }
      }
      var a = angle();
      if (a !== null) {
        var a1 = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x), a2 = Math.atan2(p[2].y - p[0].y, p[2].x - p[0].x);
        var d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ctx.beginPath(); ctx.moveTo(p[0].x * e, p[0].y * e); ctx.arc(p[0].x * e, p[0].y * e, 42 * dpr, a1, a1 + d, d < 0); ctx.closePath();
        ctx.fillStyle = "rgba(255,181,71,.28)"; ctx.fill();
      }
      p.forEach(function (q, n) {
        ctx.beginPath(); ctx.arc(q.x * e, q.y * e, 10 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = n === 0 ? "#FFB547" : "#FFFFFF"; ctx.fill();
        ctx.lineWidth = 3 * dpr; ctx.strokeStyle = n === 0 ? "#FFFFFF" : "#FFB547"; ctx.stroke();
      });
      $("#m-consigne").textContent = CONSIGNES_POINTS[Math.min(p.length, 3)];
      $("#m-angle").textContent = a === null ? "" : Math.round(a) + "°";
      $("#m-valider").disabled = a === null;
    }
    function versImage(ev) {
      var r = cv.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (cv.width / r.width) / MES.echelle, y: (ev.clientY - r.top) * (cv.height / r.height) / MES.echelle };
    }
    cv.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* pointeur déjà relâché */ }
      var q = versImage(ev), r = cv.getBoundingClientRect();
      var seuil = 30 * (cv.width / r.width) / MES.echelle; // 30 px d'écran, ramenés aux pixels de la photo
      MES.drag = -1;
      MES.pts.forEach(function (p, n) { if (Math.hypot(p.x - q.x, p.y - q.y) < seuil) MES.drag = n; });
      if (MES.drag < 0 && MES.pts.length < 3) { MES.pts.push(q); MES.drag = MES.pts.length - 1; }
      dessiner();
    });
    cv.addEventListener("pointermove", function (ev) { if (MES && MES.drag >= 0) { MES.pts[MES.drag] = versImage(ev); dessiner(); } });
    cv.addEventListener("pointerup", function () { if (MES) MES.drag = -1; });
    $("#m-refaire").onclick = function () { MES.pts = []; dessiner(); };
    $("#m-valider").onclick = function () { valider(Math.round(angle())); };
    window.addEventListener("resize", function () { if (MES && document.body.contains(cv)) taille(); });
    taille();
  }
  function valider(angle) {
    var img = MES.img, max = 1000, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    var data = c.toDataURL("image/jpeg", 0.82), id = "m" + Date.now();
    var avant = angleCourant(), palAvant = avant ? P.palierSuivant(avant) : null;
    function fini(avecPhoto) {
      etat.mesures.push({ id: avecPhoto ? id : null, d: aujourdHui(), angle: angle });
      sauver();
      try { URL.revokeObjectURL(MES.url); } catch (e) { /* rien */ }
      fermerMesure(); rendreTout();
      if (palAvant && angle >= palAvant.a) toast("Palier franchi : " + palAvant.a + "°, " + palAvant.nom + ".");
      else if (avant === null) toast("Point zéro : " + angle + "°. Tout part de là.");
      else toast(angle + "° enregistré" + (angle > avant ? ", +" + (angle - avant) + "°." : "."));
    }
    PHOTOS.mettre(id, data).then(function () { fini(true); }, function () { fini(false); toast("Angle enregistré, mais pas la photo."); });
  }

  // =====================================================================
  // PROGRÈS
  // =====================================================================
  function rendreProgres() {
    var v = $("#v-progres"), ms = mesuresTriees(), h = "";
    h += '<div class="carte apparait" style="--i:0"><div class="ligne-titre"><h2>Ton angle</h2><button class="bouton petit" id="p-mesurer">Nouvelle mesure</button></div>' +
      '<div class="graph" id="graph"></div><p class="mini">Une mesure toutes les deux semaines, toujours dans les mêmes conditions. Les écarts d\'un jour à l\'autre sont normaux.</p></div>';
    var avecPhoto = ms.filter(function (m) { return m.id; });
    if (avecPhoto.length) {
      var a = avecPhoto[0], b = avecPhoto[avecPhoto.length - 1];
      h += '<div class="carte apparait" style="--i:1"><span class="etiquette">' + (a === b ? "Ton point zéro" : "Avant · maintenant") + '</span><div class="duo-photos">' +
        '<figure><img data-photo="' + a.id + '" alt="Mesure du ' + dateCourte(a.d) + '"><figcaption><b>' + a.angle + "°</b> · " + dateCourte(a.d) + "</figcaption></figure>" +
        (a !== b ? '<figure><img data-photo="' + b.id + '" alt="Mesure du ' + dateCourte(b.d) + '"><figcaption><b>' + b.angle + "°</b> · " + dateCourte(b.d) + "</figcaption></figure>"
          : '<figure style="display:grid;place-items:center;text-align:center;color:var(--pale);font-size:14px">La prochaine photo<br>viendra ici.</figure>') +
        "</div></div>";
    }
    if (ms.length) {
      h += '<div class="carte apparait" style="--i:2"><span class="etiquette">Tes mesures</span><table class="tableau"><tbody>' +
        ms.slice().reverse().map(function (m, n, arr) {
          var prec = arr[n + 1], d = prec ? m.angle - prec.angle : null;
          return "<tr><td>" + dateCourte(m.d) + '</td><td class="doux">' + (d === null ? "point zéro" : (d >= 0 ? "+" : "") + d + "°") + '</td><td class="num">' + m.angle +
            '°</td><td class="act"><button data-suppr="' + etat.mesures.indexOf(m) + '" aria-label="Supprimer la mesure du ' + dateCourte(m.d) + '">×</button></td></tr>';
        }).join("") + "</tbody></table></div>";
    }
    var se = etat.seances.slice(-12).reverse();
    h += '<div class="carte apparait" style="--i:3"><span class="etiquette">Tes dernières séances</span>' +
      (se.length ? '<table class="tableau"><tbody>' + se.map(function (s) {
        return "<tr><td>" + dateCourte(s.d) + '</td><td class="doux">' + esc(s.nom) + (s.complet ? "" : " · arrêtée") + '</td><td class="num">' + s.min + " min</td></tr>";
      }).join("") + "</tbody></table>" : '<div class="vide">Ta première séance apparaîtra ici.</div>') + "</div>";
    v.innerHTML = h;
    graphique($("#graph"), ms);
    $("#p-mesurer").onclick = ouvrirMesure;
    $$("img[data-photo]", v).forEach(function (im) { PHOTOS.lire(im.getAttribute("data-photo")).then(function (d) { if (d) im.src = d; }, function () { /* rien */ }); });
    $$("[data-suppr]", v).forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute("data-suppr"), m = etat.mesures[i];
        if (!m || !confirm("Supprimer la mesure du " + dateCourte(m.d) + " (" + m.angle + "°) ?")) return;
        etat.mesures.splice(i, 1); sauver();
        if (m.id) PHOTOS.enlever(m.id).catch(function () { /* rien */ });
        rendreTout();
      };
    });
  }

  // Une seule série, une seule couleur : l'angle dans le temps, avec les paliers en repères
  function graphique(el, ms) {
    if (!ms.length) { el.innerHTML = '<div class="vide">Pas encore de mesure. La première sera ton point zéro.</div>'; return; }
    var W = 340, H = 210, m = { l: 34, r: 88, t: 18, b: 28 };
    var jour = 864e5, t0 = Date.parse(ms[0].d), t1 = Math.max(Date.parse(ms[ms.length - 1].d), t0 + 14 * jour);
    var vals = ms.map(function (x) { return x.angle; });
    var amin = Math.min.apply(null, vals), amax = Math.max.apply(null, vals), pal = P.palierSuivant(amax);
    var y0 = Math.max(0, Math.floor((Math.min(amin, 90) - 10) / 10) * 10);
    var y1 = Math.min(180, Math.ceil((Math.max(amax + 8, pal ? pal.a + 4 : 180)) / 10) * 10);
    function X(t) { return m.l + (t - t0) / (t1 - t0) * (W - m.l - m.r); }
    function Y(a) { return H - m.b - (a - y0) / (y1 - y0) * (H - m.t - m.b); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Évolution de ton angle d\'écart">';
    P.PALIERS.filter(function (q) { return q.a >= y0 && q.a <= y1; }).forEach(function (q) {
      var y = Y(q.a).toFixed(1);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '" stroke="#232C52" stroke-width="1"/>' +
        '<text x="' + (m.l - 6) + '" y="' + y + '" dy="4" text-anchor="end" fill="#6F7BA0" font-size="10.5" style="font-variant-numeric:tabular-nums">' + q.a + "°</text>" +
        '<text x="' + (W - m.r + 8) + '" y="' + y + '" dy="3.5" fill="#6F7BA0" font-size="10">' + esc(q.nom) + "</text>";
    });
    s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '" stroke="#2C365C" stroke-width="1"/>';
    var pts = ms.map(function (x) { return { x: X(Date.parse(x.d)), y: Y(x.angle), m: x }; });
    if (pts.length > 1) {
      var ligne = pts.map(function (p, n) { return (n ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1); }).join(" ");
      s += '<path d="' + ligne + " L" + pts[pts.length - 1].x.toFixed(1) + " " + (H - m.b) + " L" + pts[0].x.toFixed(1) + " " + (H - m.b) + ' Z" fill="#FFB547" opacity=".1"/>';
      s += '<path d="' + ligne + '" fill="none" stroke="#FFB547" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    pts.forEach(function (p) { s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="5" fill="#FFB547" stroke="#111936" stroke-width="2"/>'; });
    var der = pts[pts.length - 1];
    s += '<text x="' + der.x.toFixed(1) + '" y="' + (der.y - 12).toFixed(1) + '" text-anchor="middle" fill="#EEF2FB" font-size="13" font-weight="800">' + der.m.angle + "°</text>";
    s += '<text x="' + m.l + '" y="' + (H - 8) + '" fill="#6F7BA0" font-size="10.5">' + dateCourte(ms[0].d) + "</text>";
    if (ms.length > 1) s += '<text x="' + (W - m.r) + '" y="' + (H - 8) + '" text-anchor="end" fill="#6F7BA0" font-size="10.5">' + dateCourte(ms[ms.length - 1].d) + "</text>";
    pts.forEach(function (p, n) { s += '<circle data-pt="' + n + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="16" fill="transparent" style="cursor:pointer"/>'; });
    s += "</svg>";
    el.innerHTML = s + '<div class="info" id="g-info"></div>';
    var info = $("#g-info", el), svg = $("svg", el);
    function montrer(n) {
      var p = pts[n], r = svg.getBoundingClientRect(), k = r.width / W;
      info.innerHTML = "<b>" + p.m.angle + "°</b> · " + dateCourte(p.m.d);
      info.style.left = (p.x * k) + "px"; info.style.top = (p.y * k) + "px";
      info.classList.add("vu");
    }
    $$("[data-pt]", el).forEach(function (c) {
      var n = +c.getAttribute("data-pt");
      c.addEventListener("pointerenter", function () { montrer(n); });
      c.addEventListener("click", function () { montrer(n); });
      c.addEventListener("pointerleave", function () { info.classList.remove("vu"); });
    });
  }

  // =====================================================================
  // COMPRENDRE
  // =====================================================================
  var SAVOIRS = [
    ["🧠", "Le frein à main", "Pourquoi tout passe par le système nerveux",
      "<p>Ton écart n'est pas d'abord bloqué par la longueur de tes muscles. Il est bloqué par ton cerveau, qui serre le frein dès qu'une position lui paraît risquée. Chez l'adulte, l'essentiel des progrès des premières semaines vient de là : le système nerveux accepte d'aller un peu plus loin, séance après séance. Les tissus s'adaptent ensuite, plus lentement.</p>" +
      "<p>Et un corps qui vit en alerte serre tous les freins à la fois. Travailler ta souplesse et apprendre à ton système nerveux à redescendre, <b>c'est le même chantier</b>. Une séance du soir fait les deux.</p>"],
    ["🎚️", "La règle du 6 sur 10", "Jusqu'où aller, et quand reculer",
      "<p>Tu cherches une tension nette mais respirable, autour de 6 sur 10. Au-delà, le cerveau sonne l'alarme et resserre : tu perds ce que tu croyais gagner.</p>" +
      "<p>Trois signes que tu es allé trop loin : <b>tu bloques ta respiration, tu trembles, tu serres la mâchoire.</b> Recule alors de deux centimètres. Ce n'est pas un recul, c'est la méthode.</p>"],
    ["🌬️", "Respirer pour desserrer", "L'expiration longue, et ta montre",
      "<p>Pendant les tenues : inspire 4 secondes par le nez, expire 6 secondes par la bouche. L'expiration longue active le mode récupération, celui qui relâche le frein.</p>" +
      "<p>Le soupir physiologique (deux inspirations, une longue expiration) ouvre chaque séance : c'est le moyen connu le plus rapide pour faire baisser l'alerte.</p>" +
      "<p>Ta montre peut te guider sans écran : app <b>Pleine conscience</b>, séance <b>Respirer</b>, réglée à 6 respirations par minute dans ses réglages. Idéal pendant le mur en V, les yeux fermés.</p>"],
    ["💪", "La force jambes ouvertes", "Le levier le plus sous-estimé",
      "<p>Ton cerveau lâche plus facilement une amplitude où tu es fort. D'où la cosaque, le Copenhague, le cavalier et les glissades : tu deviens solide jambes ouvertes.</p>" +
      "<p>Pour un gardien, c'est double gain : plus d'écart, et une aine qui tient quand tu descends en urgence au poteau. Dans une grande étude norvégienne chez des footballeurs, le programme Copenhague a réduit d'environ 40 % les problèmes d'aine.</p>"],
    ["🚦", "Ton adducteur gauche", "Le feu tricolore",
      "<p>Une gêne qui revient avec la course intense, c'est souvent un adducteur qui encaisse plus qu'il ne peut. Le renforcer, Copenhague en tête, est la piste la mieux étayée. D'où le côté gauche toujours en second, et le mode prudence.</p>" +
      '<div class="feu"><div><i style="background:#5EE0C8"></i><span><b>Vert</b> : gêne à 2 sur 10 maximum pendant, revenue à la normale le lendemain matin. Tu continues.</span></div>' +
      '<div><i style="background:#FFB547"></i><span><b>Orange</b> : 3 à 5 sur 10, ou plus raide le lendemain matin. « Se fait sentir » au lancement, quelques jours.</span></div>' +
      '<div><i style="background:#FF7A6B"></i><span><b>Rouge</b> : douleur vive, plus de 5 sur 10, ou gêne pour marcher. « Douloureux » au lancement, et si ça dure, un kiné.</span></div></div>'],
    ["📅", "Les matchs et les entraînements", "Ce que l'app adapte toute seule",
      "<p>L'app connaît ton calendrier N2 2026-2027.</p><ul>" +
      "<li><b>Veille de match</b> : séance douce, pas de contracter-relâcher.</li>" +
      "<li><b>Jour de match</b> : avant l'échauffement, quatre minutes dynamiques. Pas d'étirements longs juste avant de jouer, ils coupent un peu d'explosivité. Le soir, la redescente.</li>" +
      "<li><b>Lendemain</b> : récupération.</li>" +
      "<li><b>Mardi</b> : tu rentres les muscles chauds, le meilleur soir pour gagner.</li>" +
      "<li><b>Jeudi</b> : journée chargée, on reste léger.</li></ul>"],
    ["⏳", "Combien de temps ?", "La vérité, sans enrober",
      "<p>Partir de moins de 90° pour viser le grand écart facial, c'est un chantier de plusieurs mois, souvent plus d'un an. Les premiers degrés viennent vite (le cerveau lâche), les suivants plus lentement (les tissus suivent).</p>" +
      "<p>La forme des hanches peut aussi fixer une limite que personne ne choisit : certains n'atteignent jamais le sol, quoi qu'ils fassent. L'objectif n'est donc pas une date. <b>Chaque palier, c'est du poteau couvert en plus et une aine plus solide.</b></p>"],
    ["⌚", "Ta montre, ta WHOOP, Fitness+", "Utiliser ce que tu as déjà",
      "<p><b>Apple Watch</b> : lance un entraînement Souplesse (ou Récupération) au début de la séance, il apparaîtra dans Forme et dans ta WHOOP.</p>" +
      "<p><b>WHOOP</b> : récupération dans le rouge, prends « À plat ». Sur le long terme, ta variabilité cardiaque est le meilleur témoin de ton système nerveux : regarde la tendance sur 30 jours, une fois par mois, pas tous les jours.</p>" +
      "<p><b>Fitness+</b> : un Yoga de 10 ou 20 minutes compte comme une séance, note-le avec le joker. Ton pistolet de massage, 30 secondes sur le milieu de la cuisse avant une séance, aide aussi un peu, jamais dans le pli de l'aine.</p>"],
    ["💊", "Les compléments", "Le tri honnête",
      "<p>Aucun complément ne rend souple. Ce qui ouvre, c'est la régularité, le sommeil et la respiration.</p><ul>" +
      "<li><b>Magnésium</b> : utile surtout s'il y a un manque. Bisglycinate ou glycérophosphate sont les formes les mieux tolérées par l'intestin, chlorure et oxyde le sont moins.</li>" +
      "<li><b>Créatine</b> : le complément sportif le mieux étudié, pour la force. Pas pour la souplesse, mais elle soutient le travail jambes ouvertes. Une option, pas une priorité.</li>" +
      "<li><b>Collagène et vitamine C</b> avant une séance de force : piste intéressante pour les tendons, preuves encore minces.</li>" +
      "<li><b>Vitamine D</b> l'hiver : à voir avec ton médecin, prise de sang à l'appui.</li>" +
      "<li><b>Prudence</b> : plusieurs compléments « anti-stress » interagissent avec des médicaments courants (millepertuis, 5-HTP, tryptophane, ashwagandha…). Avec un traitement en cours, pharmacien d'abord.</li></ul>" +
      "<p>Règle de Soupline : rien à acheter pour démarrer.</p>"]
  ];
  function rendreComprendre() {
    var v = $("#v-comprendre"), h = "";
    SAVOIRS.forEach(function (s, n) {
      h += '<details class="carte savoir apparait" style="--i:' + n + '"' + (n === 0 ? " open" : "") + '><summary><span class="ico" aria-hidden="true">' + s[0] + "</span><div><b>" + s[1] + "</b><span>" + s[2] + '</span></div></summary><div class="texte">' + s[3] + "</div></details>";
    });
    h += '<div class="carte apparait" style="--i:' + SAVOIRS.length + '"><span class="etiquette">Réglages</span>' +
      '<div class="reglage" style="margin-top:6px"><span>Voix pendant les séances</span><button class="interrupteur" role="switch" data-r="voix" aria-checked="' + etat.reglages.voix + '" aria-label="Voix"></button></div>' +
      '<div class="reglage"><span>Sons de respiration</span><button class="interrupteur" role="switch" data-r="sons" aria-checked="' + etat.reglages.sons + '" aria-label="Sons"></button></div>' +
      '<div class="reglage"><span>Tester la voix</span><button class="bouton petit secondaire" id="r-test">Écouter</button></div>' +
      '<div class="reglage"><span>Sauvegarder mes données</span><button class="bouton petit secondaire" id="r-export">Exporter</button></div>' +
      '<div class="reglage"><span>Restaurer une sauvegarde</span><label class="bouton petit secondaire" for="r-import">Importer</label><input type="file" id="r-import" accept="application/json,.json" hidden></div>' +
      '<div class="reglage"><span>Tout effacer</span><button class="bouton petit secondaire" id="r-effacer" style="color:#FF7A6B">Effacer</button></div>' +
      '<p class="mini">Tes données restent sur ce téléphone, rien ne part ailleurs. Avec le mode silencieux de l\'iPhone, sons et voix peuvent être coupés.</p></div>';
    h += '<p class="sources apparait" style="--i:' + (SAVOIRS.length + 1) + ';padding:0 6px 10px">Sources : Magnusson et coll. 1996 et Weppler &amp; Magnusson 2010 (tolérance à l\'étirement) · Thomas et coll. 2018 (durée et fréquence des étirements) · Harøy et coll. 2019 (programme Copenhague) · Hölmich et coll. 1999 (renforcement et douleurs d\'adducteurs) · Balban et coll. 2023 (soupir cyclique) · Behm et coll. 2016 (étirements avant l\'effort).</p>';
    v.innerHTML = h;
    $$(".interrupteur", v).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-r"); etat.reglages[k] = !etat.reglages[k]; sauver();
        b.setAttribute("aria-checked", etat.reglages[k]);
        if (k === "sons" && etat.reglages.sons) SON.cloche();
      };
    });
    $("#r-test").onclick = function () { VOIX.dire("Inspire par le nez. Et expire, longuement. Vise six sur dix, jamais la douleur."); };
    $("#r-export").onclick = exporter;
    $("#r-import").onchange = importer;
    $("#r-effacer").onclick = function () {
      if (!confirm("Effacer toutes tes séances, mesures et photos ? C'est définitif.")) return;
      etat = completer({}); sauver(); PHOTOS.vider().catch(function () { /* rien */ });
      rendreTout(); toast("Tout est effacé.");
    };
  }
  function exporter() {
    PHOTOS.toutes().catch(function () { return {}; }).then(function (ph) {
      var blob = new Blob([JSON.stringify({ app: "soupline", version: 1, date: new Date().toISOString(), etat: etat, photos: ph })], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "soupline-sauvegarde-" + aujourdHui() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  }
  function importer(e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var o = JSON.parse(r.result);
        if (!o || o.app !== "soupline" || !o.etat) throw new Error("format");
        if (!confirm("Remplacer tes données actuelles par cette sauvegarde ?")) return;
        etat = completer(o.etat); sauver();
        var ph = o.photos || {};
        Promise.all(Object.keys(ph).map(function (k) { return PHOTOS.mettre(k, ph[k]); })).catch(function () { /* rien */ }).then(function () { rendreTout(); toast("Sauvegarde restaurée."); });
      } catch (err) { toast("Ce fichier n'est pas une sauvegarde de Soupline."); }
    };
    r.readAsText(f);
  }

  // =====================================================================
  // NAVIGATION ET DÉMARRAGE
  // =====================================================================
  function montrer(vue) {
    $$(".vue").forEach(function (s) { s.classList.toggle("active", s.id === "v-" + vue); });
    $$(".onglets button").forEach(function (b) { b.classList.toggle("actif", b.getAttribute("data-vue") === vue); });
    window.scrollTo(0, 0);
    if (vue === "accueil") rendreAccueil();
    if (vue === "progres") rendreProgres();
  }
  function rendreTout() {
    var d = new Date();
    $("#date-jour").textContent = P.JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS_LONG[d.getMonth()];
    rendreAccueil(); rendreProgres(); rendreComprendre();
  }

  $$(".onglets button").forEach(function (b) { b.onclick = function () { montrer(b.getAttribute("data-vue")); }; });
  $("#l-fermer").onclick = arreter;
  $("#l-pause").onclick = basculerPause;
  $("#l-suiv").onclick = function () { if (LEC.en && LEC.compte <= 0) allerEtape(LEC.etape + 1); };
  $("#l-prec").onclick = function () {
    if (!LEC.en || LEC.compte > 0) return;
    var e = LEC.s.etapes[LEC.etape], dansEtape = LEC.s.debuts[LEC.i] + LEC.t - e.t0;
    allerEtape(dansEtape > 4 ? LEC.etape : LEC.etape - 1);
  };
  $("#l-voix").onclick = function () { etat.reglages.voix = !etat.reglages.voix; sauver(); majVoixBouton(); if (!etat.reglages.voix) VOIX.couper(); };
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (LEC.en && !LEC.pause) { garderEcran(); LEC.last = performance.now(); }
      relancerHeros();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (!LEC.en) return;
    if (e.key === " ") { e.preventDefault(); basculerPause(); }
    if (e.key === "ArrowRight") $("#l-suiv").click();
    if (e.key === "ArrowLeft") $("#l-prec").click();
    if (e.key === "Escape") arreter();
  });

  rendreTout();
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* hors ligne non disponible */ });
  }

  // Accès pour les essais
  window.SOUPLINE = { etat: function () { return etat; }, lancer: lancer, terminer: terminer, LEC: function () { return LEC; } };
})();
