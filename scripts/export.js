/**
 * FE Tactique – export de la scène affichée en JSON, pour l'analyser hors de Foundry.
 * Contenu : grille, carte du terrain case par case, Régions, murs et portes, jetons avec la fiche complète
 * de leur unité (stats, valeurs de combat, objets, traits, effets).
 *
 * La fonction n'utilise que l'API publique du module : son code peut aussi servir de macro autonome.
 */

/** Construit l'export. api = game.modules.get("fe-tactique").api */
export function buildSceneExport(api) {
  const scene = canvas?.scene;
  if (!scene) throw new Error("Aucune scène affichée.");
  const E = api.engine, C = api.config;
  const d = canvas.dimensions;
  const size = canvas.grid.size;
  const r = d.sceneRect ?? { x: d.sceneX, y: d.sceneY, width: d.sceneWidth, height: d.sceneHeight };
  const rows = Math.ceil(r.height / size), cols = Math.ceil(r.width / size);
  const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const colName = (j) => (j >= 26 ? COLS[Math.floor(j / 26) - 1] : "") + COLS[j % 26];
  const cellName = (i, j) => `${colName(j)}${i + 1}`;
  const toCell = (x, y) => ({ i: Math.floor((y - r.y) / size), j: Math.floor((x - r.x) / size) });
  const center = (i, j) => ({ x: r.x + (j + 0.5) * size, y: r.y + (i + 0.5) * size });

  // Terrain case par case (une lettre par terrain, légende jointe)
  const LETTERS = { plaine: ".", route: "=", pont: "P", foret: "F", colline: "C", fort: "T", trone: "K", porte: "D", village: "V", riviere: "R", gue: "G", montagne: "M", eau: "~", mur: "#" };
  const terrainGrid = [];
  const counts = {};
  for (let i = 0; i < rows; i++) {
    const line = [];
    for (let j = 0; j < cols; j++) {
      const t = api.terrainAtPoint({ ...center(i, j), elevation: 0 }, scene);
      counts[t] = (counts[t] ?? 0) + 1;
      line.push(LETTERS[t] ?? "?");
    }
    terrainGrid.push(line.join(" "));
  }

  // Régions : nom, terrain et cases couvertes
  const regions = scene.regions.contents.map(reg => {
    const cells = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const p = { ...center(i, j), elevation: 0 };
      let inside = false;
      try { inside = reg.polygonTree?.testPoint?.(p) ?? reg.testPoint?.(p) ?? false; } catch (e) { /* ignore */ }
      if (inside) cells.push(cellName(i, j));
    }
    return {
      name: reg.name, terrainFlag: reg.getFlag?.(C.MODULE_ID, "terrain") ?? null,
      terrain: api.regionTerrain?.(reg) ?? null,
      cells, behaviors: (reg.behaviors?.contents ?? []).map(b => b.type)
    };
  });

  // Murs et portes, en cases
  const DOOR = { 0: "mur", 1: "porte", 2: "porte secrète" };
  const walls = scene.walls.contents.map(w => {
    const [x1, y1, x2, y2] = w.c;
    const a = toCell(x1, y1), b = toCell(x2, y2);
    return { de: cellName(a.i, a.j), a: cellName(b.i, b.j), coords: w.c, type: DOOR[w.door] ?? "mur", ouverte: w.door ? w.ds === 1 : null, move: w.move, sight: w.sight };
  });

  // Jetons et unités
  const DISP = { 1: "amical", 0: "neutre", "-1": "hostile", "-2": "secret" };
  const tokens = scene.tokens.contents.map(td => {
    const a = td.actor;
    const c = toCell(td.x + 1, td.y + 1);
    const out = {
      name: td.name, case: cellName(c.i, c.j), i: c.i, j: c.j, width: td.width, height: td.height,
      disposition: DISP[td.disposition] ?? td.disposition, hidden: td.hidden, actorLink: td.actorLink,
      actor: a?.name ?? null, actorId: a?.id ?? null, terrain: api.terrainAtPoint({ ...center(c.i, c.j), elevation: td.elevation ?? 0 }, scene)
    };
    if (!a?.system?.props) return out;
    try {
      const u = api.readUnit(a, { token: td });
      const st = E.effectiveStats(u);
      const sum = E.sheetSummary(u);
      const w = E.equippedWeapon(u);
      out.unit = {
        classe: u.className, classes: Object.values(u.classes ?? {}).map(k => ({ nom: k.nom, palier: k.palier, mods: k.mods, des: k.des, armes: k.armes, rang: k.rang })),
        niveau: u.level, role: u.role, profil: u.profil, motsCles: u.keywords, palier: u.palier,
        pv: u.hp, pvMax: st.pvMax, mvt: st.mvt, blessures: u.wounds, pm: u.pm, exp: Number(a.system.props.exp ?? 0),
        stats: { base: u.parts.perso, classe: u.parts.classe, niveau: u.parts.niveau, total: u.base, enCombat: st },
        des: u.dice, rangs: u.ranks, jetons: u.jetons, bonusManuels: u.manual, bonusTemporaires: u.temp, silence: u.silenced,
        armeEquipee: w?.name ?? null, portee: w ? E.weaponRange(u, w) : null,
        fiche: { atq: sum.atq, prec: sum.prec, esq: sum.esq, crit: sum.crit, vitAtt: sum.vit_att, esqCrit: sum.esq_crit, malus: sum.malus, emplacements: sum.slots_text ?? `${sum.slots_used} / ${sum.slots}` },
        aAttribuer: String(sum.a_attribuer ?? "").replace(/<[^>]+>/g, ""),
        notes: a.system.props.notes ?? ""
      };
    } catch (err) {
      out.unitError = String(err?.message ?? err);
    }
    out.items = a.items.contents.map(i => ({ name: i.name, categorie: E.itemCategory(i), props: i.system?.props ?? {} }));
    out.effects = a.effects.contents.map(e => ({ name: e.name, statuses: [...(e.statuses ?? [])], disabled: e.disabled, flags: e.flags?.[C.MODULE_ID] ?? null }));
    return out;
  });

  return {
    format: "fe-tactique-scene-export", version: 1,
    module: game.modules.get(C.MODULE_ID)?.version, foundry: game.version, systeme: `${game.system.id} ${game.system.version}`,
    exportedAt: new Date().toISOString(),
    scene: {
      name: scene.name, background: scene.background?.src ?? scene.levels?.contents?.[0]?.background?.src ?? null,
      width: r.width, height: r.height, gridSize: size, gridType: scene.grid?.type, gridDistance: scene.grid?.distance, gridUnits: scene.grid?.units,
      padding: scene.padding, rows, cols
    },
    legendeTerrain: Object.fromEntries(Object.entries(LETTERS).map(([k, v]) => [v, C.TERRAINS[k]?.label ?? k])),
    terrain: terrainGrid, casesParTerrain: counts,
    regions, walls, tokens,
    reglages: Object.fromEntries(["terrainCosts", "durabilityOnMiss", "fortHeal", "freeDice", "traitCost", "dieCost"].map(k => { try { return [k, game.settings.get(C.MODULE_ID, k)]; } catch (e) { return [k, null]; } }))
  };
}

/** Macro : télécharge l'export de la scène affichée. */
export async function exportSceneMacro() {
  if (!game.user.isGM) return ui.notifications.warn("Réservé au MJ : l'export lit les fiches ennemies et les jetons cachés.");
  try {
    const api = game.modules.get("fe-tactique").api;
    const data = buildSceneExport(api);
    const name = `fe-export-${(canvas.scene.name || "scene").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    const save = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
    save(JSON.stringify(data, null, 2), "application/json", name);
    ui.notifications.info(`Export téléchargé : ${name} (${data.tokens.length} jetons, ${data.regions.length} Régions).`);
  } catch (err) {
    console.error("fe-tactique | export", err);
    ui.notifications.error(`Export impossible : ${err.message}`);
  }
}
