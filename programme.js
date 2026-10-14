// Soupline · le programme : exercices, séances, calendrier de la saison, phases.
// Tout est construit pour le grand écart facial d'un gardien, avec une gêne qui revient
// à l'adducteur gauche : le côté gauche passe toujours en second, et en douceur si besoin.
var PROG = (function () {
  "use strict";

  function seg(d, pose, de, a, x) {
    var o = { d: d, pose: pose, de: de, a: a || de };
    if (x) for (var k in x) o[k] = x[k];
    return o;
  }
  function somme(segs) { return segs.reduce(function (t, s) { return t + s.d; }, 0); }
  function borne(x, a, b) { return x < a ? a : x > b ? b : x; }
  function avec(base, o) { var r = {}, k; for (k in base) r[k] = base[k]; for (k in o) r[k] = o[k]; return r; }

  // Contracter-relâcher, la mécanique commune : on pousse 5 s à faible intensité,
  // on relâche en expirant, on gagne un cran, on respire. Le frein se desserre à chaque cycle.
  function pnf(pose, n, ctx, x) {
    var out = [], v = 0, pct = ctx.prudence ? "20 %" : "30 %", pas = (x.pas || 1 / Math.max(1, n)) * (ctx.prudence ? 0.6 : 1);
    var base = x.base || {};
    function P(v, c) { return avec(base, { v: v, c: c }); }
    out.push(seg(8, pose, P(0, 0), null, { souffle: true, voix: "Trouve ta position, à six sur dix. Pas plus." }));
    for (var i = 0; i < n; i++) {
      var r = (i + 1) + "/" + n, un = i === 0, v2 = Math.min(1, v + pas);
      out.push(seg(0.6, pose, P(v, 0), P(v, 1), { type: "contracte", label: "Pousse · " + pct, rep: r,
        voix: un ? x.contracte + " " + (ctx.prudence ? "Vingt" : "Trente") + " pour cent." : "Pousse." }));
      out.push(seg(4.4, pose, P(v, 1), null, { type: "contracte", label: "Pousse · " + pct, rep: r }));
      out.push(seg(3, pose, P(v, 1), P(v, 0), { label: "Relâche · expire", rep: r, voix: un ? "Relâche, et expire longuement." : "Relâche." }));
      out.push(seg(4, pose, P(v, 0), P(v2, 0), { label: "Descends un peu", rep: r, voix: un ? "Laisse descendre, un tout petit peu." : null }));
      out.push(seg(12, pose, P(v2, 0), null, { souffle: true, rep: r }));
      v = v2;
    }
    if (x.fin) out.push(seg(x.fin, pose, P(v, 0), P(Math.min(1, v + pas * 0.4), 0), { souffle: true, voix: "Reste là. Respire, et laisse faire." }));
    return out;
  }

  // ---------- Les exercices ----------
  var EXOS = {
    soupir: {
      nom: "Soupir physiologique", pose: "tailleur", vig: { s: 0.75 },
      consignes: ["Assis, dos long, mains posées sur les genoux.",
        "Deux inspirations par le nez, la seconde pour finir de remplir. Puis une longue expiration par la bouche."],
      pourquoi: "Le moyen connu le plus rapide pour faire redescendre l'alerte.",
      segments: function (o) {
        var n = o.cycles || 3, out = [];
        for (var i = 0; i < n; i++) {
          var r = (i + 1) + "/" + n, un = i === 0;
          out.push(seg(3, "tailleur", { s: 0 }, { s: 0.72 }, { sp: true, label: "Inspire", rep: r, voix: un ? "Inspire par le nez." : null, son: "inspire" }));
          out.push(seg(1.6, "tailleur", { s: 0.72 }, { s: 1 }, { sp: true, label: "Encore un peu", rep: r, voix: un ? "Encore un peu." : null }));
          out.push(seg(7, "tailleur", { s: 1 }, { s: 0 }, { sp: true, label: "Expire longuement", rep: r, voix: un ? "Et expire, longuement, par la bouche." : null, son: "expire" }));
        }
        return out;
      }
    },

    squeeze: {
      nom: "Coussin serré", pose: "squeeze", vig: { c: 0.7 },
      consignes: ["Allongé sur le dos, genoux pliés, un coussin entre les genoux.",
        "Serre 5 secondes, relâche 5 secondes. Ça réveille l'adducteur sans l'étirer."],
      pourquoi: "Contracter l'adducteur sans l'étirer : la meilleure façon de lui dire qu'il ne risque rien.",
      segments: function (o, ctx) {
        var n = o.reps || 5, doux = ctx.prudence || o.doux, pct = o.doux ? "20 %" : doux ? "30 %" : "50 %", out = [];
        var dit = o.doux ? "vingt" : doux ? "trente" : "cinquante";
        for (var i = 0; i < n; i++) {
          var r = (i + 1) + "/" + n;
          out.push(seg(0.8, "squeeze", { c: 0, doux: !!o.doux }, { c: 1, doux: !!o.doux }, { type: "contracte", label: "Serre · " + pct, rep: r,
            voix: i === 0 ? "Serre le coussin, à " + dit + " pour cent." : "Serre." }));
          out.push(seg(4.2, "squeeze", { c: 1, doux: !!o.doux }, null, { type: "contracte", label: "Serre · " + pct, rep: r }));
          out.push(seg(0.8, "squeeze", { c: 1, doux: !!o.doux }, { c: 0, doux: !!o.doux }, { label: "Relâche", rep: r, voix: "Relâche." }));
          out.push(seg(i === n - 1 ? 2 : 4.2, "squeeze", { c: 0, doux: !!o.doux }, null, { souffle: true, label: "Respire", rep: r }));
        }
        return out;
      }
    },

    rockback: {
      nom: "Bascule adducteur", pose: "rockback", cotes: true, vig: { v: 0.8, cote: "G" },
      coteNom: { D: "Jambe droite tendue", G: "Jambe gauche tendue" },
      consignes: ["À quatre pattes, une jambe tendue sur le côté, pied à plat.",
        "Recule les fesses vers le talon, dos long, puis reviens. Sans forcer."],
      pourquoi: "Un étirement en mouvement : le système nerveux l'accepte mieux qu'une position figée.",
      segments: function (o, ctx, cote) {
        var n = o.reps || 8, amp = 1, out = [];
        if (cote === "G" && ctx.prudence) { n = Math.max(4, n - 2); amp = 0.7; }
        var t = o.dyn ? [1.2, 0.3, 1.2] : [2.6, 1, 2.6];
        for (var i = 0; i < n; i++) {
          var r = (i + 1) + "/" + n, un = i === 0;
          out.push(seg(t[0], "rockback", { v: 0, cote: cote }, { v: amp, cote: cote }, { label: "Recule", rep: r, voix: un ? "Recule les fesses vers le talon." : null }));
          out.push(seg(t[1], "rockback", { v: amp, cote: cote }, null, { label: "Tiens", rep: r }));
          out.push(seg(t[2], "rockback", { v: amp, cote: cote }, { v: 0, cote: cote }, { label: "Reviens", rep: r, voix: un ? "Et reviens." : null }));
        }
        return out;
      }
    },

    grenouille: {
      nom: "Grenouille", pose: "grenouille", vig: { v: 0.7 },
      consignes: ["À genoux, genoux écartés, chevilles dans l'alignement des genoux, sur les avant-bras. Un coussin sous chaque genou.",
        "Bascule doucement d'avant en arrière, puis reste en arrière et respire."],
      pourquoi: "Ouvre l'intérieur des cuisses en douceur, le poids du corps fait le travail.",
      segments: function (o, ctx) {
        var n = o.rocks || 8, tenue = o.tenue || 45, out = [], amp = ctx.prudence ? 0.7 : 1;
        for (var i = 0; i < n; i++) {
          var r = (i + 1) + "/" + n;
          out.push(seg(3, "grenouille", { v: 0 }, { v: amp }, { label: "Recule", rep: r, voix: i === 0 ? "Bascule doucement en arrière." : null }));
          out.push(seg(3, "grenouille", { v: amp }, { v: 0 }, { label: "Avance", rep: r, voix: i === 0 ? "Et en avant." : null }));
        }
        out.push(seg(3, "grenouille", { v: 0 }, { v: amp * 0.9 }, { label: "Recule et reste", voix: "Reste en arrière. Respire, et laisse descendre." }));
        out.push(seg(tenue, "grenouille", { v: amp * 0.9 }, { v: amp }, { souffle: true }));
        return out;
      }
    },

    papillon: {
      nom: "Papillon contracter-relâcher", pose: "papillon", vig: { v: 0.4 },
      consignes: ["Assis, plantes de pieds collées, mains sur les genoux.",
        "Pousse les genoux contre tes mains 5 secondes, puis relâche en expirant et laisse-les descendre."],
      pourquoi: "Contracter puis relâcher : le frein se desserre d'un cran à chaque cycle.",
      segments: function (o, ctx) {
        return pnf("papillon", o.cycles || 3, ctx, { contracte: "Pousse les genoux contre tes mains.", fin: o.fin || 0 });
      }
    },

    ecart: {
      nom: "Écart debout", pose: "ecart", vig: { angle: 84 },
      consignes: ["Jambes écartées, pointes de pieds vers l'avant, mains sur un appui : chaise basse, pouf ou piles de livres.",
        "Pousse les pieds dans le sol comme pour les rapprocher, 5 secondes. Relâche en expirant et laisse glisser d'un centimètre."],
      pourquoi: "Ton grand écart, travaillé là où se trouve le frein.",
      segments: function (o, ctx) {
        var a0 = ctx.angleDepart, a1 = a0 + (ctx.prudence ? 6 : 10), base = { a0: a0, a1: a1 };
        if (!o.cycles) {
          return [seg(o.fin || 60, "ecart", avec(base, { v: 0 }), avec(base, { v: 0.5 }), { souffle: true, voix: "Trouve ta position, à six sur dix. Et respire." })];
        }
        return pnf("ecart", o.cycles, ctx, { contracte: "Pousse les pieds dans le sol, comme pour les rapprocher.", base: base, fin: o.fin });
      }
    },

    murV: {
      nom: "Jambes au mur en V", pose: "murV", vig: { angle: 96 },
      consignes: ["Allongé, fesses contre le mur, jambes en l'air. Laisse-les s'ouvrir en V.",
        "Le poids des jambes fait le travail. Toi, tu expires."],
      pourquoi: "Un grand écart sans effort, allongé : le meilleur moment pour que le frein lâche.",
      segments: function (o, ctx) {
        var d = o.duree || 150, a0 = o.angle || ctx.angleMur, ouvre = o.angle ? 0 : 1, out = [];
        out.push(seg(d * 0.5, "murV", { angle: a0 }, { angle: a0 + 8 * ouvre }, { souffle: true,
          voix: o.angle ? "Jambes au mur, serrées. Laisse-toi lourd, et respire." : "Laisse le poids des jambes faire le travail. Toi, tu expires." }));
        out.push(seg(d * 0.3, "murV", { angle: a0 + 8 * ouvre }, { angle: a0 + 12 * ouvre }, { souffle: true, voix: "Épaules lourdes. Mâchoire desserrée." }));
        out.push(seg(d * 0.2, "murV", { angle: a0 + 12 * ouvre }, { angle: a0 + 14 * ouvre }, { souffle: true,
          voix: "Dernières respirations. Pour sortir, plie les genoux avant de les rapprocher." }));
        return out;
      }
    },

    papillonAllonge: {
      nom: "Papillon allongé", pose: "papillonAllonge", vig: { v: 0.85 },
      consignes: ["Allongé sur le dos, plantes de pieds collées, genoux qui tombent sur les côtés.",
        "Un coussin sous chaque genou si ça tire trop. Mains sur le ventre."],
      pourquoi: "Une ouverture passive des hanches, à faible intensité : idéal pour redescendre.",
      segments: function (o) {
        return [seg(o.duree || 60, "papillonAllonge", { v: 0.35 }, { v: 1 }, { souffle: true, voix: "Laisse tomber les genoux. Respire dans le ventre." })];
      }
    },

    cosaque: {
      nom: "Fente cosaque", pose: "cosaque", vig: { v: -0.85 },
      consignes: ["Pieds très écartés. Descends sur une jambe, l'autre reste tendue, pointe vers le haut.",
        "Talons au sol, tiens un montant de porte si besoin. Lent en descendant."],
      pourquoi: "De la force jambes ouvertes : le cerveau lâche l'amplitude où tu es solide.",
      segments: function (o, ctx) {
        var n = o.reps || 5, out = [];
        var pD = ctx.phase >= 2 ? 1 : 0.8, pG = ctx.prudence ? 0.55 : pD;
        var t = o.dyn ? [1.4, 0.4, 1.2] : [3.6, 2, 2.6];
        for (var i = 0; i < n; i++) {
          var r = (i + 1) + "/" + n, un = i === 0;
          out.push(seg(t[0], "cosaque", { v: 0 }, { v: -pD }, { label: "À droite", rep: r, voix: un ? "Descends sur la jambe droite. L'autre reste tendue." : null }));
          out.push(seg(t[1], "cosaque", { v: -pD }, null, { label: "Tiens", rep: r }));
          out.push(seg(t[2], "cosaque", { v: -pD }, { v: 0 }, { label: "Remonte", rep: r }));
          out.push(seg(t[0], "cosaque", { v: 0 }, { v: pG }, { label: "À gauche", rep: r, voix: un ? (ctx.prudence ? "À gauche, moins bas." : "Et à gauche.") : null }));
          out.push(seg(t[1], "cosaque", { v: pG }, null, { label: "Tiens", rep: r }));
          out.push(seg(t[2], "cosaque", { v: pG }, { v: 0 }, { label: "Remonte", rep: r }));
        }
        return out;
      }
    },

    copenhague: {
      nom: "Copenhague", pose: "copenhague", cotes: true, vig: { v: 1, cote: "G" },
      coteNom: { D: "Jambe droite dessus", G: "Jambe gauche dessus" },
      consignes: ["Sur le côté, avant-bras au sol sous l'épaule, genou du dessus posé sur le canapé ou un banc.",
        "Monte le bassin pour aligner le corps, tiens, redescends. C'est la jambe du dessus qui travaille."],
      pourquoi: "L'exercice qui protège le mieux l'aine. Celui qu'il faut à ton adducteur gauche.",
      segments: function (o, ctx, cote) {
        var series = o.series || 2, t = o.tenue || 15, out = [], long = ctx.phase >= 3;
        if (cote === "G" && ctx.prudence) { t = Math.min(t, 10); long = false; }
        for (var i = 0; i < series; i++) {
          var r = "Série " + (i + 1) + "/" + series, un = i === 0;
          var bas = { v: 0, cote: cote, long: long }, haut = { v: 1, cote: cote, long: long };
          out.push(seg(2, "copenhague", bas, haut, { label: "Monte", rep: r, voix: un ? "Monte le bassin, le corps bien aligné." : "Monte." }));
          out.push(seg(t, "copenhague", haut, null, { type: "contracte", souffle: true, label: "Tiens", rep: r, voix: un ? "Tiens. Et respire." : null }));
          out.push(seg(2, "copenhague", haut, bas, { label: "Redescends", rep: r, voix: "Redescends doucement." }));
          if (i < series - 1) out.push(seg(8, "copenhague", bas, null, { label: "Repos", rep: r }));
        }
        return out;
      }
    },

    cavalier: {
      nom: "Cavalier", pose: "cavalier", vig: { v: 1 },
      consignes: ["Pieds larges, pointes un peu ouvertes. Descends, genoux poussés vers l'extérieur.",
        "Dos droit, poids sur les talons, et tu respires."],
      pourquoi: "Des hanches solides en ouverture : ta position de gardien, en plus bas.",
      segments: function (o) {
        var n = o.series || 2, t = o.tenue || 20, out = [];
        for (var i = 0; i < n; i++) {
          var r = n > 1 ? "Série " + (i + 1) + "/" + n : null;
          out.push(seg(2, "cavalier", { v: 0 }, { v: 1 }, { label: "Descends", rep: r, voix: i === 0 ? "Descends, genoux vers l'extérieur." : "Descends." }));
          if (o.pulse) {
            for (var k = 0; k < t; k++) out.push(seg(1, "cavalier", { v: k % 2 ? 0.78 : 1 }, { v: k % 2 ? 1 : 0.78 }, { label: "Petits rebonds", rep: r }));
          } else {
            out.push(seg(t, "cavalier", { v: 1, effort: 1 }, null, { type: "contracte", souffle: true, rep: r }));
          }
          out.push(seg(2, "cavalier", { v: 1 }, { v: 0 }, { label: "Remonte", rep: r, voix: "Remonte." }));
          if (i < n - 1) out.push(seg(8, "cavalier", { v: 0 }, null, { label: "Repos", rep: r }));
        }
        return out;
      }
    },

    glissade: {
      nom: "Glissade en écart", pose: "glissade", cotes: true, vig: { v: 0.85, cote: "G" },
      coteNom: { D: "Jambe droite qui glisse", G: "Jambe gauche qui glisse" },
      consignes: ["Chaussettes sur sol lisse, ou une serviette sous le pied. Mains sur le dossier d'une chaise.",
        "Laisse glisser la jambe sur le côté, lentement. Puis ramène-la en serrant l'intérieur de la cuisse."],
      pourquoi: "Le geste du gardien au ralenti : l'adducteur apprend à freiner puis à ramener.",
      segments: function (o, ctx, cote) {
        var n = o.reps || 5, prof = ctx.phase >= 3 ? 1 : 0.85, out = [];
        if (cote === "G" && ctx.prudence) { prof = 0.6; n = Math.max(3, n - 1); }
        for (var i = 0; i < n; i++) {
          var r = (i + 1) + "/" + n, un = i === 0;
          var z = { v: 0, cote: cote, tire: 0 }, o1 = { v: prof, cote: cote, tire: 0 };
          out.push(seg(3.6, "glissade", z, o1, { label: "Laisse glisser", rep: r, voix: un ? "Laisse glisser, lentement." : null }));
          out.push(seg(1.2, "glissade", o1, null, { label: "Tiens", rep: r }));
          out.push(seg(2.6, "glissade", avec(o1, { tire: 1 }), avec(z, { tire: 1 }), { type: "contracte", label: "Ramène en serrant", rep: r,
            voix: un ? "Ramène, en serrant l'intérieur de la cuisse." : null }));
        }
        return out;
      }
    },

    balancier: {
      nom: "Balancier latéral", pose: "balancier", cotes: true, vig: { v: 30, cote: "G" },
      coteNom: { D: "Jambe droite", G: "Jambe gauche" },
      consignes: ["Face à un mur ou une rambarde, mains posées. Balance une jambe de droite à gauche devant toi.",
        "Ample mais relâché. On réveille, on ne force pas."],
      pourquoi: "Avant un match : de l'amplitude en mouvement, sans endormir les muscles.",
      segments: function (o, ctx, cote) {
        var n = o.reps || 10, out = [seg(0.6, "balancier", { v: 0, cote: cote }, { v: -10, cote: cote }, { label: "Balance" })];
        for (var i = 0; i < n; i++) {
          var r = (i + 1) + "/" + n, amp = Math.min(1, 0.55 + i * 0.08);
          var dedans = { v: -18 * amp, cote: cote }, dehors = { v: 38 * amp, cote: cote };
          out.push(seg(0.9, "balancier", i === 0 ? { v: -10, cote: cote } : dedans, dehors, { label: "Dehors", rep: r, voix: i === 0 ? "Balance, relâché." : null }));
          out.push(seg(0.9, "balancier", dehors, dedans, { label: "Dedans", rep: r }));
        }
        return out;
      }
    }
  };

  // ---------- Les séances ----------
  var SEANCES = {
    plancher: { nom: "Plancher", sous: "Cinq minutes allongé. Même à plat, ça compte.", etapes: [["soupir", { cycles: 3 }], ["papillonAllonge", { duree: 60 }], ["murV", { duree: 150 }]] },
    plancherPlus: { nom: "Plancher +", sous: "Allongé, sans effort.", etapes: [["soupir", { cycles: 3 }], ["squeeze", { reps: 4 }], ["papillonAllonge", { duree: 60 }], ["murV", { duree: 150 }]] },
    calme: { nom: "Séance calme", sous: "On ouvre sans rien forcer.", etapes: [["soupir", { cycles: 3 }], ["squeeze", { reps: 4 }], ["rockback", { reps: 6 }], ["papillonAllonge", { duree: 60 }], ["ecart", { cycles: 0, fin: 50 }], ["murV", { duree: 120 }]] },
    standard: { nom: "Séance standard", sous: "Le cœur du programme.", etapes: [["soupir", { cycles: 3 }], ["squeeze", { reps: 5 }], ["rockback", { reps: 8 }], ["grenouille", { rocks: 8, tenue: 45 }], ["papillon", { cycles: 3 }], ["ecart", { cycles: 3, fin: 30 }], ["murV", { duree: 120 }]] },
    pleine: { nom: "Séance pleine", sous: "De la force jambes ouvertes, puis on ouvre.", etapes: [["soupir", { cycles: 3 }], ["squeeze", { reps: 5 }], ["cosaque", { reps: 5 }], ["copenhague", { series: 2, tenue: 15 }], ["cavalier", { series: 2, tenue: 20 }], ["glissade", { reps: 5, phaseMin: 2 }], ["grenouille", { rocks: 8, tenue: 45 }], ["ecart", { cycles: 4, fin: 40 }], ["papillon", { cycles: 3 }], ["murV", { duree: 120 }]] },
    avantMatch: { nom: "Avant-match", sous: "Dynamique, rien de long. Avant l'échauffement.", etapes: [["soupir", { cycles: 2 }], ["balancier", { reps: 12 }], ["cosaque", { reps: 8, dyn: true }], ["rockback", { reps: 8, dyn: true }], ["cavalier", { series: 1, tenue: 20, pulse: true }]] },
    redescente: { nom: "Redescente", sous: "Après le match, on fait retomber la pression.", etapes: [["soupir", { cycles: 5 }], ["papillonAllonge", { duree: 60 }], ["murV", { duree: 180 }]] },
    redescenteCourte: { nom: "Redescente courte", sous: "Cinq minutes, allongé.", etapes: [["soupir", { cycles: 3 }], ["papillonAllonge", { duree: 60 }], ["murV", { duree: 150 }]] },
    douleur: { nom: "Plancher prudence", sous: "On entretient sans solliciter l'aine.", etapes: [["soupir", { cycles: 5 }], ["squeeze", { reps: 3, doux: true }], ["murV", { duree: 150, angle: 26 }]] }
  };

  // Une séance prête à jouer. ctx.tempo ralentit tout sauf les mises en place (1, 1.25 ou 1.5)
  function construire(cle, ctx) {
    var S = SEANCES[cle], out = [], etapes = [], tp = ctx.tempo || 1;
    S.etapes.forEach(function (e) {
      var id = e[0], o = e[1] || {}, X = EXOS[id];
      if (o.phaseMin && ctx.phase < o.phaseMin) return;
      if (o.phaseMax && ctx.phase > o.phaseMax) return;
      var debut = out.length, cotes = X.cotes ? ["D", "G"] : [null];
      cotes.forEach(function (cote, ci) {
        var segs = X.segments(o, ctx, cote), premier = segs[0];
        if (tp !== 1) segs.forEach(function (s) { s.d = Math.round(s.d * tp * 10) / 10; });
        var nomCote = cote ? X.coteNom[cote] : null;
        var voix = ci === 0 ? X.nom + ". " + X.consignes[0] + (cote ? " " + nomCote + " d'abord." : "")
          : nomCote + (cote === "G" && ctx.prudence ? ", en douceur." : ".");
        out.push({ d: ci === 0 ? 12 : 7, pose: premier.pose, de: premier.de, a: premier.de, type: "prep",
          label: ci === 0 ? "En place" : "Change de côté", voix: voix });
        segs.forEach(function (s) { out.push(s); });
        for (var i = out.length - segs.length - 1; i < out.length; i++) { out[i].exo = id; out[i].cote = cote; out[i].nomCote = nomCote; out[i].etape = etapes.length; }
      });
      etapes.push({ id: id, nom: X.nom, debut: debut, fin: out.length, duree: somme(out.slice(debut)) });
    });
    return { cle: cle, nom: S.nom, sous: S.sous, segments: out, etapes: etapes, duree: somme(out) };
  }

  // ---------- La saison N2 2026-2027 ----------
  // [date, adversaire, 1 domicile / 0 extérieur / -1 inconnu, 1 si déplacement local]
  var MATCHS = [
    ["2026-10-03", "Wasquehal", 0], ["2026-10-10", "Aix-les-Bains", 1], ["2026-10-17", "Quintin", 0],
    ["2026-10-24", "Plonéour", 1], ["2026-10-31", "Saint-Sébastien", 0], ["2026-11-07", "Gleizé", 1],
    ["2026-11-11", "Coupe de France, préliminaire", 1], ["2026-11-14", "Lyon", 0], ["2026-11-28", "Coupe de France, 1/16e", 1],
    ["2026-12-05", "Montlhéry", 1], ["2026-12-12", "Bouguenais", 0], ["2027-01-16", "Coupe de France, 1/8e aller", -1],
    ["2027-01-23", "Pacé", 0], ["2027-01-30", "Coupe de France, 1/8e retour", -1], ["2027-02-06", "Gujan-Mestras", 1],
    ["2027-02-13", "Wasquehal", 1], ["2027-02-27", "Aix-les-Bains", 0], ["2027-03-06", "Quintin", 1],
    ["2027-03-20", "Plonéour", 0], ["2027-04-03", "Saint-Sébastien", 1], ["2027-04-10", "Gleizé", 0],
    ["2027-04-17", "Lyon", 1], ["2027-04-24", "Montlhéry", 0], ["2027-05-08", "Bouguenais", 1],
    ["2027-05-15", "Pacé", 1], ["2027-05-22", "Gujan-Mestras", 0, 1]
  ].map(function (m) { return { date: m[0], adv: m[1], dom: m[2], local: !!m[3] }; });
  var SAISON = { debut: "2026-08-24", fin: "2027-05-30" };
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function decale(d, n) { var r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return r; }
  function matchLe(j) { for (var i = 0; i < MATCHS.length; i++) if (MATCHS[i].date === j) return MATCHS[i]; return null; }
  function lieu(m) { return m.dom === 1 ? "à domicile" : m.dom === 0 ? (m.local ? "à Gujan, sans long trajet" : "à l'extérieur") : "lieu à confirmer"; }
  function prochainMatch(d) {
    var j = iso(d);
    for (var i = 0; i < MATCHS.length; i++) if (MATCHS[i].date >= j) return MATCHS[i];
    return null;
  }

  // Ce que la journée change pour la séance du soir
  function contexte(d) {
    d = d || new Date();
    var j = iso(d), jour = JOURS[d.getDay()], enSaison = j >= SAISON.debut && j <= SAISON.fin;
    var m = matchLe(j), demain = matchLe(iso(decale(d, 1))), hier = matchLe(iso(decale(d, -1)));
    var Jour = jour.charAt(0).toUpperCase() + jour.slice(1);
    if (m) return { cle: "match", jour: jour, match: m, titre: "Jour de match", ligne: m.adv + ", " + lieu(m),
      detail: "Avant l'échauffement : quatre minutes dynamiques, rien de long. Ce soir, la redescente." };
    if (demain) return { cle: "veille", jour: jour, match: demain, titre: Jour + " · veille de match", ligne: demain.adv + ", " + lieu(demain),
      detail: demain.dom === 0 && !demain.local ? "Sûrement sur la route ou à l'hôtel : le mur d'une chambre suffit. Doux ce soir."
        : "Doux ce soir : pas de contracter-relâcher la veille d'un match." };
    if (hier) return { cle: "lendemain", jour: jour, match: hier, titre: Jour + " · lendemain de match", ligne: "Après " + hier.adv,
      detail: "Les adducteurs ont pris des chocs hier. On récupère, on ouvre en douceur." };
    if (enSaison && d.getDay() === 4) return { cle: "jeudi", jour: jour, titre: "Jeudi · ta journée chargée", ligne: "Bureau, puis entraînement jusqu'à 21h30",
      detail: "Tu rentres tard et rincé : on reste léger, ça compte pareil." };
    if (enSaison && d.getDay() === 2) return { cle: "entrainement", jour: jour, titre: "Mardi · retour d'entraînement", ligne: "Muscles chauds en rentrant",
      detail: "Le meilleur soir de la semaine pour gagner des degrés." };
    return { cle: "libre", jour: jour, titre: Jour + " · soirée libre", ligne: enSaison ? "Pas de rink ce soir" : "Hors saison",
      detail: "Le bon soir pour une séance pleine si l'énergie suit." };
  }

  // Énergie (plat, normal, forme) × journée → séance proposée
  function choisir(cle, energie, adducteur) {
    if (adducteur === "douleur") return "douleur";
    if (energie === "plat") return cle === "match" ? "redescenteCourte" : "plancher";
    switch (cle) {
      case "match": return "redescente";
      case "veille": return energie === "forme" ? "calme" : "plancherPlus";
      case "lendemain": return energie === "forme" ? "standard" : "calme";
      case "jeudi": return energie === "forme" ? "standard" : "plancherPlus";
      case "entrainement": return "standard";
      default: return energie === "forme" ? "pleine" : "standard";
    }
  }

  // ---------- Phases (au cumul de minutes : rien ne se perd) ----------
  var PHASES = [
    { n: 1, nom: "Apprivoiser", de: 0, a: 150, texte: "Apprendre à ton cerveau que l'écart est sans danger." },
    { n: 2, nom: "Ouvrir", de: 150, a: 500, texte: "Les glissades arrivent, la cosaque descend plus bas." },
    { n: 3, nom: "Verrouiller", de: 500, a: null, texte: "Copenhague jambe tendue, glissades complètes : solide au poteau." }
  ];
  function phase(minutes) { return minutes < 150 ? PHASES[0] : minutes < 500 ? PHASES[1] : PHASES[2]; }

  // ---------- Paliers d'angle ----------
  var PALIERS = [
    { a: 90, nom: "Le L" }, { a: 110, nom: "Ça s'ouvre" }, { a: 130, nom: "Mi-chemin" },
    { a: 150, nom: "Écart de gardien" }, { a: 165, nom: "Presque à plat" }, { a: 180, nom: "À plat" }
  ];
  function palierSuivant(angle) {
    for (var i = 0; i < PALIERS.length; i++) if (angle < PALIERS[i].a) return PALIERS[i];
    return null;
  }

  // Réglages des positions selon ton angle mesuré (ou estimé)
  function reglages(angle, prudence, ph, tempo) {
    var a = angle || 80;
    return {
      prudence: !!prudence, phase: ph, tempo: tempo || 1,
      angleDepart: borne(Math.round(a - 8), 50, 166),
      angleMur: borne(Math.round(a + 2), 60, 166)
    };
  }

  // Toutes les phrases que la voix peut dire, pour les enregistrer une fois avec une voix naturelle
  function textesVoix(autres) {
    var vus = {};
    Object.keys(SEANCES).forEach(function (cle) {
      [1, 2, 3].forEach(function (ph) {
        [false, true].forEach(function (pru) {
          construire(cle, reglages(80, pru, ph)).segments.forEach(function (g) { if (g.voix) vus[g.voix] = 1; });
        });
      });
    });
    (autres || []).forEach(function (t) { vus[t] = 1; });
    return Object.keys(vus).sort();
  }

  return {
    EXOS: EXOS, SEANCES: SEANCES, MATCHS: MATCHS, PHASES: PHASES, PALIERS: PALIERS, textesVoix: textesVoix,
    construire: construire, contexte: contexte, choisir: choisir, phase: phase, palierSuivant: palierSuivant,
    reglages: reglages, iso: iso, prochainMatch: prochainMatch, JOURS: JOURS
  };
})();
