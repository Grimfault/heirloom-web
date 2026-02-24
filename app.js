/* 
 Heirloom Web Prototype - Single JS Bundle
 Includes:
  - app.deploy.v6.1.traitfix.js  (core app + start gating fixed)
  - ui.enhancements.v1.traitfix.js (helper UI interactions; no Start-button override)
 Order: app first, then UI helpers.
*/


// === BEGIN core app (traitfix) ===
/* Heirloom Web Prototype v0.1 (Data-driven)
   - Loads: ./data/cards.json, ./data/events.json, ./data/backgrounds.json
   - Supports: requirements → disabled outcomes with reasons
   - Card levels: uses level 1 by default (upgrade-ready later)
*/
console.log("✅ app.js loaded");

// ---------- Theme (Candlelit Ledger) ----------
const THEME_KEY = "heirloom_theme";
function getStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return (t === "candle" || t === "ink") ? t : "ink";
  } catch {
    return "ink";
  }
}
function applyTheme(theme) {
  const t = (theme === "candle" || theme === "ink") ? theme : "ink";
  document.documentElement.dataset.theme = t;

  const label = (t === "ink") ? "Ink" : "Candle";
  const menuLabel = (t === "ink") ? "Theme: Ink" : "Theme: Candle";

  const btn = document.getElementById("btnTheme");
  if (btn) btn.textContent = menuLabel;

  const btnMenu = document.getElementById("btnMenuTheme");
  if (btnMenu) btnMenu.textContent = menuLabel;

  try { localStorage.setItem(THEME_KEY, t); } catch {}
}
function toggleTheme() {
  const cur = (document.documentElement.dataset.theme === "candle") ? "candle" : "ink";
  applyTheme(cur === "ink" ? "candle" : "ink");
}
function initThemeUI() {
  // Respect any early <head> theme set; otherwise use localStorage default.
  const existing = document.documentElement.dataset.theme;
  const t = (existing === "candle" || existing === "ink") ? existing : getStoredTheme();
  applyTheme(t);

  const btn = document.getElementById("btnTheme");
  if (btn && !btn.__heirloomBound) {
    btn.addEventListener("click", toggleTheme);
    btn.__heirloomBound = true;
  }

  const btnMenu = document.getElementById("btnMenuTheme");
  if (btnMenu && !btnMenu.__heirloomBound) {
    btnMenu.addEventListener("click", toggleTheme);
    btnMenu.__heirloomBound = true;
  }
}

initThemeUI();


// ---------- Pixel Icon Helpers ----------
const ICON_VER = "20260216a";
const BUILD_ID = "majorpill-fix-20260216a";
try { console.info("[Heirloom]", BUILD_ID); } catch {}
const icon = (p) => (p ? (p + "?v=" + ICON_VER) : null);

const ICONS = {
  ctx: {
    Strife:  icon("icons/ctx_strife.png"),
    Court:   icon("icons/ctx_court.png"),
    Scheme:  icon("icons/ctx_scheme.png"),
    Journey: icon("icons/ctx_journey.png"),
    Lore:    icon("icons/ctx_lore.png"),
  },
  disc: {
    Steel:  icon("icons/disc_steel.png"),
    Quill:  icon("icons/disc_quill.png"),
    Veil:   icon("icons/disc_veil.png"),
    Seal:   icon("icons/disc_seal.png"),
    Hearth: icon("icons/disc_hearth.png"),
    Wild:   icon("icons/disc_wild.png"),
  }
};


function iconImg(src, cls="icoImg") {
  if (!src) return "";
  return `<img class="${cls}" src="${src}" alt="" aria-hidden="true" decoding="async" loading="lazy">`;
}

function discBadgeHtml(disc) {
  const d = disc || "Wild";
  const src = (ICONS.disc[d] || null);
  // New icon set already includes its own circular border; keep wrapper only for sizing/layout.
  return `<span class="uiIconWrap uiIconWrapDisc" data-disc="${d}">${iconImg(src, "uiIcon uiIconDisc")}</span>`;
}

function ctxBadgeHtml(ctx) {
  const c = ctx || "";
  const src = (ICONS.ctx[c] || null);
  return `<span class="uiIconWrap uiIconWrapCtx" data-ctx="${c}">${iconImg(src, "uiIcon uiIconCtx")}</span>`;
}

function playableScenesHtml(card) {
  if (!card) return "";
  if (isWildCard(card)) {
    return `<div class="scenesIcons"><span class="sceneToken sceneTokenAny"><span class="sceneTokenLabel">ANY</span></span></div>`;
  }
  const arr = (card.contexts || []).filter(Boolean);
  if (!arr.length) {
    return `<div class="scenesIcons"><span class="sceneToken sceneTokenAny"><span class="sceneTokenLabel">ANY</span></span></div>`;
  }

  const ABBR = {
    Strife: "STR",
    Scheme: "SCH",
    Court: "CRT",
    Journey: "JRN",
    Lore: "LOR",
  };

  // Render all scenes (up to 5) in a compact row that reads on mobile.
  const toks = arr.slice(0, 5).map(ctx => {
    const ab = (ABBR[ctx] || String(ctx).slice(0, 3).toUpperCase());
    return `<span class="sceneToken" title="${ctx}">
      ${ctxBadgeHtml(ctx)}
      <span class="sceneTokenLabel">${ab}</span>
    </span>`;
  });

  return `<div class="scenesIcons">${toks.join("")}</div>`;
}


const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const deepCopy = (obj) => (obj == null ? null : JSON.parse(JSON.stringify(obj)));

const MAJOR_AGES = new Set([20,25,30,35,40,45,50]);
const SEASONS = ["Vernal", "Autumnal"];

const DEFAULT_FACTIONS = [
  { id: "crown", short: "Crown", name: "The Crown of Valewyr", defaultTier: "Neutral" },
  { id: "league", short: "League", name: "The Marcher League", defaultTier: "Neutral" },
  { id: "covenant", short: "Covenant", name: "The Iron Covenant", defaultTier: "Neutral" },
  { id: "synod", short: "Synod", name: "The Verdant Synod", defaultTier: "Neutral" },
  { id: "collegium", short: "Collegium", name: "The Grey Collegium", defaultTier: "Neutral" },
  { id: "emirate", short: "Emirate", name: "The Ashen Emirate", defaultTier: "Neutral" }
];


const OPPORTUNITY_GAP_MIN = 4; // encounter appears every 4–6 completed events
const OPPORTUNITY_GAP_MAX = 6;


// --- Meta currencies (scaffolding) ---
// Scrip: earned during a bloodline; spent during Opportunity encounters to upgrade cards in your current deck.
// Legacy: earned ONLY when the bloodline ends (no heir). Banked for a future bloodline tree.
// Heirlooms: rare meta currency (future) used to unlock permanent cards / event packs / storylines.
const META_KEY = "heirloom_meta_v01";
let META = { legacy: 0, heirlooms: 0, legacyTree: { trunk: {}, big: {}, branches: {} } };

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return;
    const m = JSON.parse(raw);
    if (m && typeof m === "object") {
      META.legacy = Number.isFinite(m.legacy) ? m.legacy : 0;
      META.heirlooms = Number.isFinite(m.heirlooms) ? m.heirlooms : 0;
      if (m.legacyTree && typeof m.legacyTree === "object") META.legacyTree = m.legacyTree;
    }
  } catch {}
  ensureMetaTree();
}

function saveMeta() {
  ensureMetaTree();
  try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch {}
}

// ---------- Legacy Tree (Meta Progression) ----------
// Stored in META.legacyTree (localStorage). Safe to evolve: missing fields are defaulted.
const TRUNK_RANK_COSTS = [2, 3, 4, 6, 8];   // ranks 1..5
const BRANCH_RANK_COSTS = [4, 6, 8, 10, 12]; // ranks 1..5

const LEGACY_TREE = {
  trunk: [
    { id: "t_packed_satchel",    name: "Packed Satchel",    max: 5, desc: "+1 starting Supplies per rank." },
    { id: "t_stashed_coin",      name: "Stashed Coin",      max: 5, desc: "+1 starting Coin per rank." },
    { id: "t_known_name",        name: "Known Name",        max: 5, desc: "+1 starting Renown per rank." },
    { id: "t_old_introductions", name: "Old Introductions", max: 5, desc: "+1 starting Influence per rank." },
    { id: "t_quiet_compromises", name: "Quiet Compromises", max: 5, desc: "+1 starting Secrets per rank." },
    { id: "t_hardened_years",    name: "Hardened Years",    max: 5, desc: "-1% Mortality chance per rank." },
    { id: "t_steady_hands",      name: "Steady Hands",      max: 5, desc: "+1% success chance per rank." },
    { id: "t_better_odds",       name: "Better Odds",       max: 5, desc: "+1 Redraw token per life per rank (redraw your hand during an event)." },
    { id: "t_heirs_upbringing",  name: "Heir’s Upbringing", max: 5, desc: "Succession: additional +Focus stat at ranks 3 and 5." },
    { id: "t_dynastic_memory",   name: "Dynastic Memory",   max: 5, desc: "+1 Legacy gained at end-of-life per rank." }
  ],
  big: [
    { id: "b_heirloom_vault",  name: "Heirloom Vault", cost: 35, desc: "Start each new run with the Wild card “Candle Witness” added to your deck." , prereqTrunkIndex: 2 },
    { id: "b_second_breath",   name: "Second Breath",  cost: 45, desc: "Once per life, survive a fatal Mortality Check with a severe consequence.", prereqTrunkIndex: 6 },
    { id: "b_fate_stitching",  name: "Fate Stitching", cost: 45, desc: "Once per life, you may Mulligan your hand (free redraw).", prereqTrunkIndex: 9 }
  ],
  branches: {
    steel: {
      title: "Steel",
      subtitle: "Strife-forward: decisive, risky, respected.",
      nodes: [
        { id: "s_hard_blows",       name: "Hard Blows",       max: 5, desc: "+2% success chance per rank in Strife." },
        { id: "s_battle_reputation",name: "Battle Reputation",max: 5, desc: "On Strife success, gain bonus Renown (stronger at higher ranks)." },
        { id: "s_scar_tissue",      name: "Scar Tissue",      max: 5, desc: "Wounded is less punishing (downgrades at higher ranks)." }
      ],
      capstone: { id: "s_battle_tempo", name: "Battle Tempo", cost: 50, desc: "In Strife events, draw +1 card (before condition caps)." }
    },
    quill: {
      title: "Quill",
      subtitle: "Lore & planning: knowledge wins wars you never fight.",
      nodes: [
        { id: "q_keen_eye",    name: "Keen Eye",    max: 5, desc: "+2% success chance per rank in Lore." },
        { id: "q_methodical",  name: "Methodical",  max: 5, desc: "Reduce the 'stat gap' penalty by 1 per rank." },
        { id: "q_notes",       name: "Margin Notes",max: 5, desc: "On Lore success, gain bonus Secrets (stronger at higher ranks)." }
      ],
      capstone: { id: "q_archivists_certainty", name: "Archivist’s Certainty", cost: 50, desc: "In Lore events, draw +1 card (before condition caps)." }
    },
    veil: {
      title: "Veil",
      subtitle: "Schemes & shadows: leverage, escape, quiet power.",
      nodes: [
        { id: "v_slip_net",    name: "Slip the Net", max: 5, desc: "+2% success chance per rank in Scheme." },
        { id: "v_dirty_leverage", name: "Dirty Leverage", max: 5, desc: "On Scheme success, gain bonus Secrets (stronger at higher ranks)." },
        { id: "v_cool_head",   name: "Cool Head", max: 5, desc: "Wanted is less punishing (downgrades at higher ranks)." }
      ],
      capstone: { id: "v_shadow_alias", name: "Shadow Alias", cost: 50, desc: "The first time you would gain Wanted (Severe) each life, it becomes Minor instead." }
    },
    seal: {
      title: "Seal",
      subtitle: "Court & influence: alliances, favors, and public weight.",
      nodes: [
        { id: "se_presence",  name: "Court Presence", max: 5, desc: "+2% success chance per rank in Court." },
        { id: "se_favors",    name: "Favors Called",  max: 5, desc: "On Court success, gain bonus Influence (stronger at higher ranks)." },
        { id: "se_immunity",  name: "Polished Mask",  max: 5, desc: "Disgraced is less punishing (downgrades at higher ranks)." }
      ],
      capstone: { id: "se_network", name: "Network of Favors", cost: 50, desc: "In Court events, draw +1 card (before condition caps)." }
    },
    hearth: {
      title: "Hearth",
      subtitle: "Endurance & recovery: survive long enough to matter.",
      nodes: [
        { id: "h_endure",   name: "Endure", max: 5, desc: "-1% additional Mortality chance per rank." },
        { id: "h_clean_living", name: "Clean Living", max: 5, desc: "Reduce duration of new Minor conditions (stronger at higher ranks)." },
        { id: "h_second_wind", name: "Second Wind", max: 5, desc: "After Major Events, remove one Minor condition (chance improves with ranks)." }
      ],
      capstone: { id: "h_unbroken_year", name: "Unbroken Year", cost: 50, desc: "At the start of each Major Event, remove one Minor condition." }
    }
  }
};

function ensureMetaTree() {
  META.legacyTree ??= {};
  META.legacyTree.trunk ??= {};
  META.legacyTree.big ??= {};
  META.legacyTree.branches ??= {};
  for (const k of Object.keys(LEGACY_TREE.branches)) META.legacyTree.branches[k] ??= {};
}

function trunkRank(id) {
  ensureMetaTree();
  return clamp(Number(META.legacyTree.trunk[id] ?? 0) || 0, 0, 5);
}
function branchRank(branchKey, id) {
  ensureMetaTree();
  return clamp(Number(META.legacyTree.branches?.[branchKey]?.[id] ?? 0) || 0, 0, 5);
}
function bigUnlocked(id) {
  ensureMetaTree();
  return Boolean(META.legacyTree.big?.[id]);
}

function trunkNodeUnlocked(idx) {
  if (idx <= 0) return true;
  const prev = LEGACY_TREE.trunk[idx - 1]?.id;
  return trunkRank(prev) >= 1;
}
function trunkAllTouched() {
  return LEGACY_TREE.trunk.every(n => trunkRank(n.id) >= 1);
}

function branchNodeUnlocked(branchKey, idx) {
  if (!trunkAllTouched()) return false;
  if (idx <= 0) return true;
  const prev = LEGACY_TREE.branches[branchKey].nodes[idx - 1]?.id;
  return branchRank(branchKey, prev) >= 1;
}
function branchCapUnlocked(branchKey) {
  const capId = LEGACY_TREE.branches[branchKey]?.capstone?.id;
  return capId ? bigUnlocked(capId) : false;
}

function nextRankCost(costs, nextRank) {
  if (nextRank < 1 || nextRank > 5) return null;
  return costs[nextRank - 1];
}

function buyTrunkRank(nodeId) {
  ensureMetaTree();
  const node = LEGACY_TREE.trunk.find(n => n.id === nodeId);
  if (!node) return { ok: false, msg: "Unknown trunk node." };
  const idx = LEGACY_TREE.trunk.findIndex(n => n.id === nodeId);
  if (!trunkNodeUnlocked(idx)) return { ok: false, msg: "Locked. Unlock the previous trunk node first." };

  const cur = trunkRank(nodeId);
  if (cur >= node.max) return { ok: false, msg: "Already max rank." };
  const next = cur + 1;
  const cost = nextRankCost(TRUNK_RANK_COSTS, next);
  if ((META.legacy ?? 0) < cost) return { ok: false, msg: "Not enough Legacy." };

  META.legacy -= cost;
  META.legacyTree.trunk[nodeId] = next;
  saveMeta();
  return { ok: true };
}

function buyBig(id) {
  ensureMetaTree();
  const boons = LEGACY_TREE.big.slice();
  // also allow branch capstones as "big" unlocks
  for (const k of Object.keys(LEGACY_TREE.branches)) {
    boons.push(LEGACY_TREE.branches[k].capstone);
  }
  const node = boons.find(n => n.id === id);
  if (!node) return { ok: false, msg: "Unknown boon." };
  if (bigUnlocked(id)) return { ok: false, msg: "Already unlocked." };

  // Prereq gating for trunk big boons
  const trunkBoon = LEGACY_TREE.big.find(n => n.id === id);
  if (trunkBoon) {
    const needIdx = trunkBoon.prereqTrunkIndex ?? 0;
    if (!trunkNodeUnlocked(needIdx) || trunkRank(LEGACY_TREE.trunk[needIdx]?.id) < 1) {
      return { ok: false, msg: "Locked. Advance further down the trunk." };
    }
  }

  // Branch capstones require branch fully touched (all branch nodes at least rank 1)
  for (const k of Object.keys(LEGACY_TREE.branches)) {
    const cap = LEGACY_TREE.branches[k].capstone;
    if (cap?.id === id) {
      if (!trunkAllTouched()) return { ok: false, msg: "Locked. Unlock every trunk node at least once." };
      const allTouched = LEGACY_TREE.branches[k].nodes.every(n => branchRank(k, n.id) >= 1);
      if (!allTouched) return { ok: false, msg: "Locked. Unlock each branch node at least once." };
    }
  }

  const cost = node.cost ?? 0;
  if ((META.legacy ?? 0) < cost) return { ok: false, msg: "Not enough Legacy." };

  META.legacy -= cost;
  META.legacyTree.big[id] = true;
  saveMeta();
  return { ok: true };
}

function buyBranchRank(branchKey, nodeId) {
  ensureMetaTree();
  const branch = LEGACY_TREE.branches[branchKey];
  if (!branch) return { ok: false, msg: "Unknown branch." };
  const idx = branch.nodes.findIndex(n => n.id === nodeId);
  if (idx < 0) return { ok: false, msg: "Unknown branch node." };
  if (!branchNodeUnlocked(branchKey, idx)) {
    return { ok: false, msg: trunkAllTouched() ? "Locked. Unlock the previous branch node first." : "Locked. Unlock every trunk node at least once." };
  }
  const node = branch.nodes[idx];
  const cur = branchRank(branchKey, nodeId);
  if (cur >= node.max) return { ok: false, msg: "Already max rank." };
  const next = cur + 1;
  const cost = nextRankCost(BRANCH_RANK_COSTS, next);
  if ((META.legacy ?? 0) < cost) return { ok: false, msg: "Not enough Legacy." };

  META.legacy -= cost;
  META.legacyTree.branches[branchKey][nodeId] = next;
  saveMeta();
  return { ok: true };
}


function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtLegacy(n) { return `${Math.max(0, Math.floor(n ?? 0))}`; }

function updateLegacyUIBadges() {
  if (legacyTotalEl) legacyTotalEl.textContent = fmtLegacy(META.legacy ?? 0);
  if (legacyStartLineEl) legacyStartLineEl.textContent = `Legacy: ${fmtLegacy(META.legacy ?? 0)}`;
}

function nodeCard({ title, meta, desc, locked=false, actions=[] }) {
  const el = document.createElement("div");
  el.className = "legacyNode" + (locked ? " locked" : "");
  const actionsHtml = actions.map(a => a.outerHTML).join("");
  el.innerHTML = `
    <div class="rowTitle">
      <div class="nodeName">${escapeHtml(title)}</div>
      <div class="nodeMeta">${meta}</div>
    </div>
    <div class="nodeDesc muted">${escapeHtml(desc)}</div>
    <div class="nodeActions">${actionsHtml}</div>
  `;
  // Attach handlers after innerHTML
  const btns = el.querySelectorAll("button[data-action]");
  for (const b of btns) {
    const action = b.getAttribute("data-action");
    const payload = b.getAttribute("data-payload");
    if (action === "trunk") b.addEventListener("click", () => { buyTrunkRank(payload); renderLegacyPage(); });
    if (action === "branch") {
      const [bk, nid] = payload.split("|");
      b.addEventListener("click", () => { buyBranchRank(bk, nid); renderLegacyPage(); });
    }
    if (action === "big") b.addEventListener("click", () => { buyBig(payload); renderLegacyPage(); });
  }
  return el;
}

function renderLegacyPage() {
  if (!elLegacy) return;
  ensureMetaTree();
  updateLegacyUIBadges();

  if (legacyTrunkEl) legacyTrunkEl.innerHTML = "";
  if (legacyBranchesEl) legacyBranchesEl.innerHTML = "";

  // Trunk (+ Great Boons interleaved after trunk nodes 3, 7, 10)
  if (legacyTrunkEl) {
    LEGACY_TREE.trunk.forEach((n, idx) => {
      const r = trunkRank(n.id);
      const unlocked = trunkNodeUnlocked(idx);
      const nextCost = (r < n.max) ? nextRankCost(TRUNK_RANK_COSTS, r + 1) : null;
      const meta =
        `<span class="rankPill">Rank ${r}/${n.max}</span>` +
        (nextCost ? `<span class="muted small">Next: ${nextCost} Legacy</span>` : `<span class="muted small">Max</span>`);

      const actions = [];
      const btn = document.createElement("button");
      btn.className = "btn primary small";
      btn.textContent = (r < n.max) ? `Upgrade (+${r + 1})` : "Maxed";
      btn.disabled = !unlocked || r >= n.max || (META.legacy ?? 0) < (nextCost ?? 0);
      btn.setAttribute("data-action", "trunk");
      btn.setAttribute("data-payload", n.id);
      actions.push(btn);

      if (!unlocked) {
        const lock = document.createElement("div");
        lock.className = "muted small";
        lock.textContent = "Unlock the previous trunk node to access this.";
        actions.push(lock);
      }

      legacyTrunkEl.appendChild(nodeCard({ title: n.name, meta, desc: n.desc, locked: !unlocked, actions }));

      // Insert Great Boons that unlock after this trunk node
      const boonsHere = (LEGACY_TREE.big ?? []).filter(b => (b.prereqTrunkIndex ?? -1) === idx);
      for (const b of boonsHere) {
        const boonUnlocked = bigUnlocked(b.id);
        const cost = b.cost ?? 0;

        const prereqNode = LEGACY_TREE.trunk[idx];
        const prereqMet = prereqNode ? (trunkRank(prereqNode.id) >= 1) : true;

        const boonMeta = boonUnlocked
          ? `<span class="rankPill">Great Boon • Unlocked</span>`
          : `<span class="rankPill">Great Boon • Cost ${cost}</span>`;

        const boonBtn = document.createElement("button");
        boonBtn.className = boonUnlocked ? "btn ghost small" : "btn primary small";
        boonBtn.textContent = boonUnlocked ? "Unlocked" : "Unlock";
        boonBtn.disabled = boonUnlocked || !prereqMet || (META.legacy ?? 0) < cost;
        boonBtn.setAttribute("data-action", "big");
        boonBtn.setAttribute("data-payload", b.id);

        const boonActions = [boonBtn];

        if (!prereqMet) {
          const note = document.createElement("div");
          note.className = "muted small";
          note.textContent = `Unlock Rank 1+ in “${prereqNode?.name ?? "the prerequisite trunk node"}” to access this boon.`;
          boonActions.push(note);
        }

        legacyTrunkEl.appendChild(nodeCard({ title: b.name, meta: boonMeta, desc: b.desc, locked: !prereqMet, actions: boonActions }));
      }
    });
  }

  // Branches
  if (legacyBranchesEl) {
    const unlockedBranches = trunkAllTouched();
    if (!unlockedBranches) {
      const note = document.createElement("div");
      note.className = "muted";
      note.textContent = "Branches are locked. Unlock at least one rank in every trunk node first.";
      legacyBranchesEl.appendChild(note);
    }

    for (const [key, branch] of Object.entries(LEGACY_TREE.branches)) {
      const group = document.createElement("div");
      group.className = "branchGroup";

      const header = document.createElement("div");
      header.className = "branchHeader";
      const h = document.createElement("h4");
      h.textContent = branch.title;
      const sub = document.createElement("div");
      sub.className = "muted small";
      sub.textContent = branch.subtitle;
      header.appendChild(h);
      header.appendChild(sub);
      group.appendChild(header);

      const nodesWrap = document.createElement("div");
      nodesWrap.className = "branchNodes";

      branch.nodes.forEach((n, idx) => {
        const r = branchRank(key, n.id);
        const unlocked = branchNodeUnlocked(key, idx);
        const nextCost = (r < n.max) ? nextRankCost(BRANCH_RANK_COSTS, r + 1) : null;
        const meta =
          `<span class="rankPill">Rank ${r}/${n.max}</span>` +
          (nextCost ? `<span class="muted small">Next: ${nextCost} Legacy</span>` : `<span class="muted small">Max</span>`);

        const btn = document.createElement("button");
        btn.className = "btn primary small";
        btn.textContent = (r < n.max) ? "Upgrade" : "Maxed";
        btn.disabled = !unlocked || r >= n.max || (META.legacy ?? 0) < (nextCost ?? 0);
        btn.setAttribute("data-action", "branch");
        btn.setAttribute("data-payload", `${key}|${n.id}`);

        nodesWrap.appendChild(nodeCard({ title: n.name, meta, desc: n.desc, locked: !unlocked, actions: [btn] }));
      });

      // Capstone block (still rendered inside each branch)
      const cap = branch.capstone;
      const capUnlocked = bigUnlocked(cap.id);
      const capCost = cap.cost ?? 0;
      const allTouched = trunkAllTouched() && branch.nodes.every(n => branchRank(key, n.id) >= 1);
      const capMeta = capUnlocked ? `<span class="rankPill">Unlocked</span>` : `<span class="rankPill">Cost ${capCost}</span>`;

      const capBtn = document.createElement("button");
      capBtn.className = capUnlocked ? "btn ghost small" : "btn primary small";
      capBtn.textContent = capUnlocked ? "Unlocked" : "Unlock Capstone";
      capBtn.disabled = capUnlocked || !allTouched || (META.legacy ?? 0) < capCost;
      capBtn.setAttribute("data-action", "big");
      capBtn.setAttribute("data-payload", cap.id);

      nodesWrap.appendChild(nodeCard({ title: cap.name, meta: capMeta, desc: cap.desc, locked: !allTouched, actions: [capBtn] }));

      group.appendChild(nodesWrap);
      legacyBranchesEl.appendChild(group);
    }
  }
}



// Tunables (meaningful, not run-trivializing)
const SCRIP_PER_EVENT = 1;
const SCRIP_PER_MAJOR_BONUS = 1;
const SCRIP_ON_DEATH_BONUS = 5;

// Upgrade costs by rarity (Common < Uncommon < Rare). Wild is treated as Uncommon.
const UPGRADE_COSTS = {
  Common: [0, 6, 10],     // cost to go 1->2, 2->3 (index = current level)
  Uncommon: [0, 10, 16],
  Rare: [0, 16, 24],
  Wild: [0, 10, 16]
};

function awardScrip(amount, reason = "") {
  if (!state) return;
  state.scrip = (state.scrip ?? 0) + (amount ?? 0);
  // Keep log light; you can swap to UI pips later.
  if (amount && reason) log(`+${amount} Scrip (${reason}).`);
}

// Award baseline Scrip per resolved event.
// If events ever define a numeric `scrip` field, it is used instead of the baseline.
function awardScripForResolvedEvent(ev, isMajor = false) {
  if (!state) return;
  const explicit = (ev && typeof ev.scrip === "number") ? ev.scrip : null;
  let amount = (explicit != null) ? explicit : SCRIP_PER_EVENT;
  if (isMajor) amount += SCRIP_PER_MAJOR_BONUS;
  if (amount > 0) awardScrip(amount, isMajor ? "event + major" : "event");
}

// If a card only has a single defined level in JSON, treat that as *Level 2* (today's baseline),
// and auto-generate Level 1 (weaker) + Level 3 (stronger) so upgrades work.
// This keeps your data files small while restoring the 3-level upgrade loop.
const AUTO_LEVEL1_MULT = 0.75;
const AUTO_LEVEL3_MULT = 1.25;

function scaleInt(amount, mult) {
  const x = Number(amount);
  if (!Number.isFinite(x) || x === 0) return amount;
  const scaled = Math.round(x * mult);
  // preserve sign and ensure small magnitudes remain meaningful
  if (x > 0) return Math.max(1, scaled);
  return Math.min(-1, scaled);
}

function scaleBundleAmounts(bundle, mult) {
  if (!bundle || typeof bundle !== "object") return bundle;
  const out = deepCopy(bundle);
  if (Array.isArray(out.resources)) {
    out.resources = out.resources.map(r => ({
      ...r,
      amount: scaleInt(r.amount ?? 0, mult)
    }));
  }
  return out;
}

function uniqConditions(list) {
  const out = [];
  const seen = new Set();
  for (const c of (list ?? [])) {
    const key = `${c.id}|${c.mode}|${c.severity ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function scaleWildOnPlay(baseOnPlay, toLevel) {
  // Base is treated as Level 1 for Wild cards.
  const out = deepCopy(baseOnPlay ?? {});
  // Scale resources: +1 per level above base.
  if (Array.isArray(out.resources)) {
    out.resources = out.resources.map(r => {
      const amt = Number(r.amount ?? 0);
      if (!Number.isFinite(amt) || amt === 0) return r;
      const scaled = amt + (toLevel - 1) * (amt > 0 ? 1 : -1);
      return { ...r, amount: scaled };
    });
  }

  // Improve conditions in a small, readable way.
  // Rules:
  // - Downgrade -> Remove at Level 3
  // - For Wounded/Ill downgrades: Level 2 also removes Exhausted; Level 3 removes the target condition
  // - For Quiet Prayer (remove Exhausted): Level 2 downgrades Ill; Level 3 removes Ill
  if (Array.isArray(out.conditions)) {
    const conds = deepCopy(out.conditions);

    // Quiet Prayer pattern: remove Exhausted
    const removesExhausted = conds.some(x => x.id === "Exhausted" && x.mode === "Remove");
    if (removesExhausted) {
      if (toLevel === 2) conds.push({ id: "Ill", mode: "Downgrade" });
      if (toLevel >= 3) conds.push({ id: "Ill", mode: "Remove" });
    }

    for (const c of conds) {
      if (toLevel >= 3 && c.mode === "Downgrade") {
        // Level 3 turns downgrades into removals (strong payoff).
        c.mode = "Remove";
      }
    }

    // Wounded/Ill downgrade helpers
    const downgradesWoundedOrIll = conds.some(x => (x.id === "Wounded" || x.id === "Ill") && x.mode === (toLevel >= 3 ? "Remove" : "Downgrade"));
    if (downgradesWoundedOrIll && toLevel >= 2) {
      conds.push({ id: "Exhausted", mode: "Remove" });
    }

    out.conditions = uniqConditions(conds);
  }

  return out;
}

function expandedThreeLevelsFromSingleWild(baseLevel) {
  const base = deepCopy(baseLevel ?? {});
  // Authored Wild cards are treated as Level 1 baseline.
  const lvl1 = deepCopy(base);
  lvl1.level = 1;
  lvl1.onPlay = scaleWildOnPlay(lvl1.onPlay ?? {}, 1);

  const lvl2 = deepCopy(base);
  lvl2.level = 2;
  lvl2.onPlay = scaleWildOnPlay(lvl2.onPlay ?? {}, 2);

  const lvl3 = deepCopy(base);
  lvl3.level = 3;
  lvl3.onPlay = scaleWildOnPlay(lvl3.onPlay ?? {}, 3);

  for (const l of [lvl1, lvl2, lvl3]) {
    if (typeof l.partialOnFail !== "boolean") l.partialOnFail = false;
    if (!Number.isFinite(l.bonus)) l.bonus = 0;
    l.onSuccess ??= {};
    l.onFailure ??= {};
    l.onPlay ??= {};
  }
  return [lvl1, lvl2, lvl3];
}



function expandedThreeLevelsFromSingle(baseLevel) {
  const base = deepCopy(baseLevel ?? {});
  // Level 2 is the "current" strength (numbers in JSON today)
  const lvl2 = deepCopy(base);
  lvl2.level = 2;
  lvl2.onSuccess = scaleBundleAmounts(lvl2.onSuccess ?? {}, 1.0);
  lvl2.onFailure = scaleBundleAmounts(lvl2.onFailure ?? {}, 1.0);

  const lvl1 = deepCopy(base);
  lvl1.level = 1;
  if (Number.isFinite(lvl1.bonus)) lvl1.bonus = scaleInt(lvl1.bonus, AUTO_LEVEL1_MULT);
  lvl1.onSuccess = scaleBundleAmounts(lvl1.onSuccess ?? {}, AUTO_LEVEL1_MULT);
  lvl1.onFailure = scaleBundleAmounts(lvl1.onFailure ?? {}, AUTO_LEVEL1_MULT);

  const lvl3 = deepCopy(base);
  lvl3.level = 3;
  if (Number.isFinite(lvl3.bonus)) lvl3.bonus = scaleInt(lvl3.bonus, AUTO_LEVEL3_MULT);
  lvl3.onSuccess = scaleBundleAmounts(lvl3.onSuccess ?? {}, AUTO_LEVEL3_MULT);
  lvl3.onFailure = scaleBundleAmounts(lvl3.onFailure ?? {}, AUTO_LEVEL3_MULT);

  // Ensure partialOnFail is explicitly present
  for (const l of [lvl1, lvl2, lvl3]) {
    if (typeof l.partialOnFail !== "boolean") l.partialOnFail = false;
    l.onSuccess ??= {};
    l.onFailure ??= {};
  }
  return [lvl1, lvl2, lvl3];
}

function ensureThreeLevelCards(cards) {
  for (const c of (cards ?? [])) {
    if (!c || typeof c !== "object") continue;
    if (!Array.isArray(c.levels) || c.levels.length === 0) {
      c.levels = isWildCard(c) ? expandedThreeLevelsFromSingleWild({ level: 1, bonus: 0, partialOnFail: false, onSuccess: {}, onFailure: {}, onPlay: {} }) : expandedThreeLevelsFromSingle({ level: 2, bonus: 0, partialOnFail: false, onSuccess: {}, onFailure: {} });
      continue;
    }
    const maxLvl = Math.max(1, ...c.levels.map(l => Number(l?.level ?? 1) || 1));
    if (maxLvl >= 3) continue; // already supports upgrades
    if (c.levels.length === 1) {
      c.levels = isWildCard(c) ? expandedThreeLevelsFromSingleWild(c.levels[0]) : expandedThreeLevelsFromSingle(c.levels[0]);
    } else {
      // If someone authored 2 levels, keep them and add a derived 3rd.
      const byLevel = Object.fromEntries(c.levels.map(l => [Number(l.level ?? 1), l]));
      const base = byLevel[2] ?? byLevel[1] ?? c.levels[0];
      const lvl3 = expandedThreeLevelsFromSingle(base)[2];
      const lvl1 = byLevel[1] ?? expandedThreeLevelsFromSingle(base)[0];
      const lvl2 = byLevel[2] ?? expandedThreeLevelsFromSingle(base)[1];
      c.levels = [lvl1, lvl2, lvl3];
    }
  }
}

function computeLegacyGain() {
  // Legacy gained at end-of-life (per ruler). Tuned for prototype pacing.
  const renown = state?.res?.Renown ?? 0;
  const heirsRuled = state?.heirCount ?? 0;
  const age = state?.age ?? STARTING_AGE;
  const base = Math.max(0, Math.floor(renown / 2) + heirsRuled + Math.floor((age - STARTING_AGE) / 5));
  const bonus = trunkRank("t_dynastic_memory") ?? 0;
  return Math.max(0, base + bonus);
}

function maxCardLevel(card) {
  const levels = card?.levels ?? [];
  return Math.max(1, ...levels.map(l => l.level ?? 1));
}

function tryUpgradeCard(cardId) {
  const c = DATA.cardsById[cardId];
  if (!c) return { ok: false, msg: "Unknown card." };

  state.cardLevels ??= {};
  const cur = state.cardLevels[cardId] ?? 1;
  const maxLvl = maxCardLevel(c);
  if (cur >= maxLvl) return { ok: false, msg: "Already max level." };

  const rarity = c.rarity ?? "Common";
  const costTable = UPGRADE_COSTS[rarity] ?? UPGRADE_COSTS.Common;
  const cost = costTable[cur] ?? costTable[costTable.length - 1] ?? 10;

  if ((state.scrip ?? 0) < cost) return { ok: false, msg: `Need ${cost} Scrip.` };

  // No-op protection: don't charge for an upgrade that doesn't change gameplay.
  const curData = (c.levels ?? []).find(x => x.level === cur) || getCardLevelData(c);
  const nextData = (c.levels ?? []).find(x => x.level === (cur + 1));
  if (nextData) {
    const a = deepCopy(curData); delete a.level;
    const b = deepCopy(nextData); delete b.level;
    // Normalize missing bundles
    a.onSuccess ??= {}; a.onFailure ??= {}; a.onPlay ??= {};
    b.onSuccess ??= {}; b.onFailure ??= {}; b.onPlay ??= {};
    if (JSON.stringify(a) === JSON.stringify(b)) {
      return { ok: false, msg: "That upgrade would have no effect." };
    }
  }

  state.scrip -= cost;
  state.cardLevels[cardId] = cur + 1;
  saveState();
  return { ok: true, msg: `Upgraded to Level ${cur + 1} (-${cost} Scrip).` };
}


// ---------- Storylines (explicit draw + pacing + pity) ----------
/*
  Goals:
  - You *will* encounter storyline content in a reasonable time window (even with only a few storylines loaded).
  - Story hooks have an explicit draw roll, weighted by rarity and eligibility.
  - Once a storyline step is played, the next step is scheduled 4–8 events later,
    and never appears on a Major Beat.
*/
const STORYLINE_BASE_CHANCE = 0.32;        // baseline per non-major event to pull a storyline hook (if eligible)
const STORYLINE_MAX_CHANCE  = 0.70;        // cap (ramp won't exceed this)
const STORYLINE_RAMP_START  = 6;           // after this many non-story events in a row, hook chance ramps up
const STORYLINE_RAMP_PER_EVENT = 0.05;     // additional chance per event past ramp start
const STORYLINE_PITY_EVENTS = 10;          // force a hook attempt after this many non-story events in a row

const STORYLINE_STEP_GAP_MIN = 4;
const STORYLINE_STEP_GAP_MAX = 8;
const MAX_ACTIVE_STORYLINES = 2;
const STORYLINE_RARITY_WEIGHTS = { common: 6, uncommon: 3, rare: 1 };


const STATS = ["Might","Wit","Guile","Gravitas","Resolve"];
const RES = ["Coin","Supplies","Renown","Influence","Secrets"];
const TIERS = ["Hostile","Wary","Neutral","Favored","Exalted"];

// ---------- Data (loaded) ----------
let DATA = {
  cards: [],
  events: [],
  backgrounds: [],
  factions: [],
  ambitions: [],
  ambitionsMeta: null,
  cardsById: {},
  eventsById: {},
  backgroundsById: {},
  factionsById: {},
  ambitionsById: {}
};

// ---------- DOM ----------
const elStart = document.getElementById("startScreen");
const elGame = document.getElementById("gameScreen");
const elLegacy = document.getElementById("legacyScreen");
const elMenu = document.getElementById("menuScreen");
const topbarEl = document.getElementById("topbar");
const footerEl = document.getElementById("footerTip");

const btnMenuStart = document.getElementById("btnMenuStart");
const btnStartBack = document.getElementById("btnStartBack");
const btnLegacy = document.getElementById("btnLegacy");
const btnLegacyBack = document.getElementById("btnLegacyBack");
const legacyTotalEl = document.getElementById("legacyTotal");
const legacyStartLineEl = document.getElementById("legacyStartLine");
const legacyTrunkEl = document.getElementById("legacyTrunk");
const legacyBigEl = document.getElementById("legacyBig");
const legacyBranchesEl = document.getElementById("legacyBranches");

const bgSelect = document.getElementById("bgSelect");
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");
const btnResolve = document.getElementById("btnResolve");
const btnNewEvent = document.getElementById("btnNewEvent");
const btnDebugPickEvent = document.getElementById("btnDebugPickEvent");

const charNameInput = document.getElementById("charName");
const familyNameInput = document.getElementById("familyName");
const allocRemainingEl = document.getElementById("allocRemaining");
const allocTotalEl = document.getElementById("allocTotal");
const statCapHintEl = document.getElementById("statCapHint");
const allocGrid = document.getElementById("allocGrid");
const traitsListEl = document.getElementById("traitsList");

const statusLine = document.getElementById("statusLine");
const statsLine = document.getElementById("statsLine");
const resourceLine = document.getElementById("resourceLine");
const standingLine = document.getElementById("standingLine");
const conditionLine = document.getElementById("conditionLine");
const majorPill = document.getElementById("majorPill");

const eventName = document.getElementById("eventName");
const eventMeta = document.getElementById("eventMeta");
const eventPrompt = document.getElementById("eventPrompt");
const outcomesEl = document.getElementById("outcomes");

const handEl = document.getElementById("hand");
const handHint = document.getElementById("handHint");
const handTitle = document.getElementById("handTitle");
const btnRedrawHand = document.getElementById("btnRedrawHand");
const btnMulliganHand = document.getElementById("btnMulliganHand");
const handTokensEl = document.getElementById("handTokens");

const slot1 = document.getElementById("slot1");
const slot2 = document.getElementById("slot2");

const chanceLine = document.getElementById("chanceLine");
const chanceBreakdown = document.getElementById("chanceBreakdown");
const btnChanceMath = document.getElementById("btnChanceMath");
const logEl = document.getElementById("log");

const bootMsg = document.getElementById("bootMsg");
const setBootMsg = (msg) => { if (bootMsg) bootMsg.textContent = msg || ""; };

const START_ALLOC_POINTS = 5;
const STAT_CAP = 10;
const BASELINE_STAT = 1;
const STAT_SCALE = STAT_CAP / 5; // 2.0 when STAT_CAP is 10
const DIFF_SCALE = STAT_SCALE; // keep outcome diffs 1–5 but scale internally
const MORTALITY_RESOLVE_MULT = 1; // 10 Resolve should equal old 5 Resolve mitigation

function ensureStatScale() {
  if (STAT_CAP !== 10) return;
  if (!state?.stats) return;
  if (state._statScale === STAT_CAP) return;

  const maxStat = Math.max(...STATS.map(s => state.stats[s] ?? 0));
  // Old saves top out at 5; scale them up so they play the same under the new system.
  if (maxStat <= 5) {
    for (const s of STATS) {
      state.stats[s] = clamp((state.stats[s] ?? 0) * STAT_SCALE, 0, STAT_CAP);
    }
  }
  state._statScale = STAT_CAP;
}

const STARTING_AGE = 16;
const MAX_MARRIAGE_AGE = 45;

const TRAITS = [
  // All traits are balanced to: net +2 stat points and +3 resource points (Coin: +2 = 1 point).
  // Some traits include a stat tradeoff (negative stat) but still net to +2 stats overall.

  { id: "road_hardened", name: "Road Hardened", desc: "Start with +1 Resolve, +1 Might, +2 Supplies, and +2 Coin.",
    statMods: { Resolve: 1, Might: 1 }, resMods: { Supplies: 2, Coin: 2 } },

  { id: "court_polish", name: "Court Polish", desc: "Start with +1 Gravitas, +1 Wit, +2 Influence, and +1 Renown.",
    statMods: { Gravitas: 1, Wit: 1 }, resMods: { Influence: 2, Renown: 1 } },

  { id: "ledgerwise", name: "Ledgerwise", desc: "Start with +1 Wit, +1 Guile, +4 Coin, and +1 Influence.",
    statMods: { Wit: 1, Guile: 1 }, resMods: { Coin: 4, Influence: 1 } },

  { id: "alley_instinct", name: "Alley Instinct", desc: "Start with +1 Guile, +1 Resolve, +2 Secrets, and +1 Supplies.",
    statMods: { Guile: 1, Resolve: 1 }, resMods: { Secrets: 2, Supplies: 1 } },

  { id: "oath_temper", name: "Oath Temper", desc: "Start with +1 Resolve, +1 Gravitas, +1 Renown, +1 Influence, and +1 Supplies.",
    statMods: { Resolve: 1, Gravitas: 1 }, resMods: { Renown: 1, Influence: 1, Supplies: 1 } },

  { id: "candle_calm", name: "Candle Calm", desc: "Start with +2 Resolve, +1 Influence, +1 Supplies, and +1 Secrets.",
    statMods: { Resolve: 2 }, resMods: { Influence: 1, Supplies: 1, Secrets: 1 } },

  { id: "caravan_born", name: "Caravan Born", desc: "Start with +1 Wit, +1 Resolve, +2 Supplies, and +2 Coin.",
    statMods: { Wit: 1, Resolve: 1 }, resMods: { Supplies: 2, Coin: 2 } },

  { id: "ink_scholar", name: "Ink Scholar", desc: "Start with +2 Wit, +1 Secrets, +1 Influence, and +2 Coin.",
    statMods: { Wit: 2 }, resMods: { Secrets: 1, Influence: 1, Coin: 2 } },

  { id: "hard_bargain", name: "Hard Bargain", desc: "Start with +1 Gravitas, +1 Guile, +4 Coin, and +1 Influence.",
    statMods: { Gravitas: 1, Guile: 1 }, resMods: { Coin: 4, Influence: 1 } },

  { id: "whisper_network", name: "Whisper Network", desc: "Start with +1 Guile, +1 Wit, +2 Secrets, and +1 Influence.",
    statMods: { Guile: 1, Wit: 1 }, resMods: { Secrets: 2, Influence: 1 } },

  { id: "river_sense", name: "River Sense", desc: "Start with +1 Wit, +1 Gravitas, +2 Influence, and +2 Coin.",
    statMods: { Wit: 1, Gravitas: 1 }, resMods: { Influence: 2, Coin: 2 } },

  { id: "stern_mercy", name: "Stern Mercy", desc: "Start with +1 Resolve, +1 Gravitas, +1 Influence, +1 Supplies, and +2 Coin.",
    statMods: { Resolve: 1, Gravitas: 1 }, resMods: { Influence: 1, Supplies: 1, Coin: 2 } },

  { id: "quiet_name", name: "Quiet Name", desc: "Start with +1 Resolve, +1 Wit, +2 Renown, and +1 Supplies.",
    statMods: { Resolve: 1, Wit: 1 }, resMods: { Renown: 2, Supplies: 1 } },

  { id: "field_medic", name: "Field Medic", desc: "Start with +1 Resolve, +1 Wit, +2 Supplies, and +1 Influence.",
    statMods: { Resolve: 1, Wit: 1 }, resMods: { Supplies: 2, Influence: 1 } },

  // ---- Tradeoff traits (include a -1 stat, but still net +2 stats) ----
  { id: "fiery_charm", name: "Fiery Charm", desc: "Start with +2 Might, +1 Gravitas, -1 Resolve, +2 Renown, and +2 Coin.",
    statMods: { Might: 2, Gravitas: 1, Resolve: -1 }, resMods: { Renown: 2, Coin: 2 } },

  { id: "suspicious_mind", name: "Suspicious Mind", desc: "Start with +2 Guile, +1 Wit, -1 Gravitas, +2 Secrets, and +2 Coin.",
    statMods: { Guile: 2, Wit: 1, Gravitas: -1 }, resMods: { Secrets: 2, Coin: 2 } },

  { id: "scholar_blindspot", name: "Scholar Blindspot", desc: "Start with +2 Wit, +1 Resolve, -1 Might, +2 Influence, and +1 Supplies.",
    statMods: { Wit: 2, Resolve: 1, Might: -1 }, resMods: { Influence: 2, Supplies: 1 } },

  { id: "masked_motive", name: "Masked Motive", desc: "Start with +2 Gravitas, +1 Guile, -1 Wit, +1 Influence, +1 Secrets, and +2 Coin.",
    statMods: { Gravitas: 2, Guile: 1, Wit: -1 }, resMods: { Influence: 1, Secrets: 1, Coin: 2 } },

  { id: "stone_stubborn", name: "Stone Stubborn", desc: "Start with +2 Resolve, +1 Might, -1 Guile, +2 Supplies, and +1 Renown.",
    statMods: { Resolve: 2, Might: 1, Guile: -1 }, resMods: { Supplies: 2, Renown: 1 } },

  { id: "reckless_rider", name: "Reckless Rider", desc: "Start with +2 Might, +1 Guile, -1 Resolve, +1 Supplies, and +4 Coin.",
    statMods: { Might: 2, Guile: 1, Resolve: -1 }, resMods: { Supplies: 1, Coin: 4 } }
];




const HEIR_NAMES = [
  "Alden","Rowan","Elric","Tamsin","Bran","Edric","Mira","Sabine","Garrick","Linette",
  "Hugh","Isolde","Corin","Maera","Alina","Cedric","Ronan","Eloen","Soren","Willa"
];

// ---------- Names & Cultures (World Bible bias) ----------
const CULTURES = [
  { id: "valewyr", name: "Valewyran", weight: 4,
    female: ["Mira","Isolde","Sabine","Linette","Willa","Alina","Maera","Tamsin","Eloen","Anwen","Cerys","Elowen"],
    male:   ["Alden","Rowan","Elric","Bran","Edric","Garrick","Hugh","Cedric","Ronan","Corin","Soren","Leof"],
    surnames: ["Thorne","Ashford","Cairn","Hawke","Bracken","Rook","Fenwick","Darrow","Mallory","Varr"]
  },
  { id: "marcher", name: "Marcher", weight: 3,
    female: ["Sabina","Marin","Etta","Vesper","Lysa","Coralie","Nella","Viola","Seren","Kara"],
    male:   ["Bastian","Orren","Jory","Perrin","Silas","Dario","Nico","Talon","Rafe","Cass"],
    surnames: ["Vell","Kest","Mercer","Pryde","Locke","Dane","Sable","Grove","Farrow","Wex"]
  },
  { id: "covenant", name: "Covenant", weight: 2,
    female: ["Brynja","Sigrid","Halla","Yrsa","Runa","Freydis","Tove","Inga"],
    male:   ["Sten","Ulf","Eirik","Hakon","Torsten","Bjorn","Kjell","Rurik"],
    surnames: ["Stonehand","Bearcloak","Ironbeard","Frostborn","Wolfmark","Ashenhelm","Ravenhook"]
  },
  { id: "ashen", name: "Ashen", weight: 2,
    female: ["Nadira","Samira","Yasmin","Zahra","Farah","Amira","Layla","Ranya"],
    male:   ["Khalid","Omar","Rafiq","Tariq","Zahir","Naseem","Azim","Hadi"],
    surnames: ["al-Sahir","ibn Vashir","Qadir","Nassar","Zaydan","Rahim","Sadiq"]
  },
  { id: "verdant", name: "Verdant", weight: 1,
    female: ["Elspeth","Agnes","Beatrix","Sera","Liora","Maribel"],
    male:   ["Gideon","Lucan","Piers","Ansel","Mathis","Bram"],
    surnames: ["Green","Vigil","Candle","Vow","Moss","Lark"]
  }
];

function pickWeighted(items, weightFn) {
  const total = items.reduce((s, it) => s + (weightFn(it) || 0), 0);
  if (total <= 0) return items[0] ?? null;
  let roll = Math.random() * total;
  for (const it of items) {
    roll -= (weightFn(it) || 0);
    if (roll <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}

function randomCulture(bias = {}) {
  // bias: {cultureId: multiplier}
  return pickWeighted(CULTURES, c => (c.weight ?? 1) * (bias[c.id] ?? 1)) || CULTURES[0];
}

function randomGivenName(culture, gender = "any") {
  const c = culture || randomCulture();
  const pool = (gender === "female") ? c.female
    : (gender === "male") ? c.male
    : ((Math.random() < 0.5) ? c.female : c.male);
  return pool[rInt(0, pool.length - 1)];
}

function generateProspect() {
  // Prospect is biased young; your age makes things harder later via event weighting + requirements.
  // Background nudges who you tend to meet.
  const bg = state?.backgroundId;
  const bias = {};
  if (bg === "guild_factor") bias.marcher = 1.8;
  if (bg === "caravan_scout") bias.ashen = 1.7;
  if (bg === "novice") bias.verdant = 2.0;
  if (bg === "outlaw") bias.marcher = 1.3;
  if (bg === "hedge_knight") bias.covenant = 1.2;

  const culture = randomCulture(bias);
  const gender = "female"; // prototype: meet "a woman" as requested; easy to broaden later
  const given = randomGivenName(culture, gender);

  // Medieval-ish: prospects trend 16–26, but can skew up a bit when you are older.
  const baseMin = 16;
  const baseMax = 26;
  const skew = Math.max(0, Math.floor((state?.age ?? 16) - 26) / 5);
  const age = clamp(rInt(baseMin, baseMax + skew), 16, 32);

  const surname = (culture.surnames ?? [state?.familyName ?? ""]).length
    ? culture.surnames[rInt(0, culture.surnames.length - 1)]
    : (state?.familyName ?? "");

  const temper = pick(["quick-witted","reserved","warm","proud","pious","pragmatic","sharp-eyed"]);
  const station = pick(["minor household","merchant kin","temple ward","soldier's family","scribe's line"]);
  const dowry = rInt(1, 4);

  return {
    given,
    family: surname,
    cultureId: culture.id,
    cultureName: culture.name,
    age,
    temper,
    station,
    dowry
  };
}

function hasSpouse() {
  return Boolean(state?.family?.spouse);
}
function hasHeir() {
  return (state?.family?.heirs?.length ?? 0) > 0;
}

// Classify events for difficulty tuning.
// Keeps "general" as the baseline, makes story/faction beats a touch tighter,
// and treats major beats as the most dangerous.
function classifyEventKind(ev, opts = {}) {
  if (!ev) return "general";

  // Forced major beat (e.g., age milestone) should always read as major difficulty.
  if (opts.majorBeat) return "major";

  const kRaw = (ev.kind ?? "").toString().toLowerCase();
  if (kRaw === "major") return "major";
  if (kRaw && kRaw !== "general") return kRaw; // allow future kinds like "faction" etc.

  // Storyline steps should be a little tighter than general events.
  try {
    if (typeof isStoryEvent === "function" && isStoryEvent(ev)) return "faction";
  } catch {}

  return "general";
}

function difficultyProfileForEvent(ev, opts = {}) {
  // Middle-ground tuning:
  // - General events: still easiest, but not free.
  // - Faction/story: modestly tighter.
  // - Major: noticeably tighter.
  // Legacy should matter, but early lives shouldn't feel doomed.
  
  const kind = classifyEventKind(ev, opts);

  // Target: general events feel approachable with one good card,
  // but "story/faction" beats and majors remain meaningfully risky.
  let prof;
  if (kind === "general") prof = { base: 62, statMult: 4, diffMult: (8 / DIFF_SCALE) };
  else if (kind === "faction") prof = { base: 60, statMult: 4, diffMult: (9 / DIFF_SCALE) };
  else if (kind === "major") prof = { base: 56, statMult: 4, diffMult: (10 / DIFF_SCALE) };
  else prof = { base: 60, statMult: 4, diffMult: (9 / DIFF_SCALE) };

  // Gentle late-game ramp: start tightening after ~35.
  const age = state?.age ?? 16;
  const ageRamp = Math.max(0, Math.floor((age - 35) / 10)); // 0 at 16–34, 1 at 35–44, etc.
  prof = {
    ...prof,
    base: prof.base - (ageRamp * 1),
    diffMult: prof.diffMult + (ageRamp * 0.20)
  };

  return prof;
}

function computeChanceParts(outcome, committedCids, opts = {}) {
  const ev = opts.ev ?? currentEvent;
  const majorBeat = Boolean(opts.majorBeat ?? (typeof isMajorEventNow === "function" ? isMajorEventNow() : false));

  const statVal = state.stats[outcome.stat] ?? 0;
  const diffRating = outcome.diff ?? 3;
  const diff = diffRating * DIFF_SCALE;

  const cardBonus = (committedCids ?? []).reduce((sum, cid) => {
    const c = DATA.cardsById[cid];
    if (!c) return sum;
    return sum + (getCardLevelData(c).bonus ?? 0);
  }, 0);

  const prof = difficultyProfileForEvent(ev, { majorBeat });

  // Extra "gap pressure" so difficulty above your stat is meaningfully scary,
  // even if the base math is generous.
  const gap = Math.max(0, diff - statVal);
  const gapPenalty = gap * 1.5;

  const condMod = conditionChanceModifier(ev, outcome, committedCids);

  const raw = prof.base + (statVal * prof.statMult) + cardBonus - (diff * prof.diffMult) - gapPenalty + condMod;
  const chance = clamp(raw, 5, 95);

  return {
    chance,
    raw,
    prof,
    statVal,
    diff,
    diffRating,
    cardBonus,
    gapPenalty,
    condMod,
    majorBeat
  };
}

function computeChance(outcome, committedCids, opts = {}) {
  const parts = computeChanceParts(outcome, committedCids, opts);
  return Math.round(parts.chance);
}

function conditionChanceModifier(ev, outcome, committedCids) {
  // Conditions should matter in a way the player can feel:
  // - Light "friction" always
  // - Bigger penalties in matching contexts
  // - A small upside for Oathbound in legitimate play, downside for Veil
  let mod = 0;
  const ctx = ev?.context;
  const stat = outcome?.stat;

  // General friction: death isn't the only cost of conditions.
  for (const c of (state.conditions ?? [])) {
    if (c.severity === "Minor") mod -= 1;
    else if (c.severity === "Severe") mod -= 3;
  }

  // Focused penalties
  const ill = conditionSeverity("Ill");
  if (ill) {
    const p = (ill === "Severe") ? -10 : -6;
    if (ctx === "Journey" || ctx === "Lore" || stat === "Wit" || stat === "Resolve") mod += p;
    else mod += (ill === "Severe") ? -6 : -3;
  }

  const wounded = conditionSeverity("Wounded");
  if (wounded) {
    const p = (wounded === "Severe") ? -12 : -6;
    if (ctx === "Strife" || stat === "Might") mod += p;
    else mod += (wounded === "Severe") ? -6 : -3;
  }

  const starving = conditionSeverity("Starving");
  if (starving) {
    const p = (starving === "Severe") ? -12 : -6;
    if (ctx === "Journey" || ctx === "Strife" || stat === "Might" || stat === "Resolve") mod += p;
    else mod += (starving === "Severe") ? -6 : -3;
  }

  const disgraced = conditionSeverity("Disgraced");
  if (disgraced) {
    const p = (disgraced === "Severe") ? -10 : -6;
    if (ctx === "Court" || stat === "Gravitas") mod += p;
    else mod += (disgraced === "Severe") ? -5 : -2;
  }

  const wanted = conditionSeverity("Wanted");
  if (wanted) {
    const p = (wanted === "Severe") ? -14 : -9;
    if (ctx === "Court") mod += p;
    else mod += (wanted === "Severe") ? -8 : -4;
  }

  if (hasCondition("In Debt")) {
    // Debt is a constant drag; bigger when you're trying to do public / expensive things.
    if (ctx === "Court" || ctx === "Journey") mod -= 2;
  }

  if (hasCondition("Oathbound")) {
    const allowed = outcome?.allowed ?? [];
    if (allowed.includes("Seal") || stat === "Gravitas") mod += 3;
    if (allowed.includes("Veil") || stat === "Guile") mod -= 3;
  }

  // Tiny relief: committing a Hearth card helps you keep it together.
  const hasHearth = (committedCids ?? []).some(cid => DATA.cardsById[cid]?.discipline === "Hearth");
  if (hasHearth) mod += 2;

  return mod;
}

function chanceBand(pct) {
  // 20% bands
  if (pct <= 20) return "Desperate";
  if (pct <= 40) return "Hard";
  if (pct <= 60) return "Moderate";
  if (pct <= 80) return "Easy";
  return "Trivial";
}

function arrowsForBonus(bonusPct) {
  // 1 arrow per 5% edge. (Negative bonuses show down-arrows.)
  const v = (bonusPct ?? 0);
  const n = Math.max(0, Math.floor(Math.abs(v) / 5));
  if (!n) return "";
  return (v >= 0 ? "↑" : "↓").repeat(n);
}

function isWildCard(card) {
  return Boolean(card && card.discipline === "Wild");
}

function rarityPips(rarity) {
  switch (rarity) {
    case "Common": return "•";
    case "Uncommon": return "••";
    case "Rare": return "•••";
    default: return "•";
  }
}

function cardRarityMark(card) {
  if (!card) return "•";
  if (isWildCard(card)) return "✦";
  return rarityPips(card.rarity);
}

function formatResDelta(resource, amount) {
  const n = Math.abs(amount ?? 0);
  const arrow = (amount ?? 0) >= 0 ? "↑" : "↓";
  return `${arrow}${n} ${resource}`;
}

function formatCondDelta(ch) {
  if (!ch) return "";
  const id = prettyConditionId(ch.id);
  const mode = ch.mode ?? "Add";
  if (mode === "Remove") return `Remove ${id}`;
  if (mode === "Downgrade") return `Ease ${id}`;
  if (mode === "Upgrade") return `Worsen ${id}`;
  return `${id}`;
}

function bundleInlineSummary(bundle) {
  if (!bundle) return "";
  const parts = [];
  for (const d of (bundle.resources ?? [])) {
    const amt = d.amount ?? 0;
    if (!amt) continue;
    parts.push(formatResDelta(d.resource, amt));
  }
  for (const c of (bundle.conditions ?? [])) {
    const s = formatCondDelta(c);
    if (s) parts.push(s);
  }
  return parts.join(" · ");
}

function cardRiderText(card) {
  if (!card) return "";
  const lvl = getCardLevelData(card);

  // Wild cards: the effect happens immediately when played.
  if (isWildCard(card)) {
    const t = bundleInlineSummary(lvl.onPlay);
    return t ? `Use anytime • ${t}` : "Use anytime";
  }

  // Discipline cards: riders trigger only on success/failure.
  const onS = bundleInlineSummary(lvl.onSuccess);
  const onF = bundleInlineSummary(lvl.onFailure);

  const parts = [];
  if (onS) parts.push(`✓ ${onS}`);
  if (onF) parts.push(`✗ ${onF}`);
  return parts.join(" / ");
}

function cardScenesText(card) {
  if (!card) return "";
  if (isWildCard(card)) return "Any scene";
  return cardSceneText(card.contexts);
}


function hash32(str) {
  // small deterministic hash for stable flavor selection
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

const CARD_FLAVOR = {
  Steel: [
    "Steel answers faster than doubt.",
    "A hard lesson, repeated until it sticks.",
    "One clean motion beats ten brave ideas.",
    "You learned to hit first—and then breathe."
  ],
  Quill: [
    "Ink makes order out of noise.",
    "A small note now saves a costly mistake later.",
    "You let the details do the fighting.",
    "A line on paper can move a room."
  ],
  Veil: [
    "A truth withheld is still a weapon.",
    "You step where the light doesn't reach.",
    "The best lie is the one that feels familiar.",
    "Quiet hands, loud results."
  ],
  Seal: [
    "Authority is a blade with a polished edge.",
    "You speak in terms people can't ignore.",
    "A favor remembered is stronger than a threat.",
    "Rules bend for those who know where to press."
  ],
  Hearth: [
    "You hold steady when the world shakes.",
    "Warmth is a kind of armor.",
    "You refuse to break—quietly, completely.",
    "Endurance wins the days no one sings about."
  ]
};

function cardFlavor(c) {
  if (!c) return "";
  if (typeof c.flavor === "string" && c.flavor.trim()) return c.flavor.trim();
  const pool = CARD_FLAVOR[c.discipline] || ["A practiced habit, honed by necessity."];
  const key = String(c.id || c.name || c.discipline || "");
  const idx = hash32(key) % pool.length;
  return pool[idx];
}

function cardSceneText(ctxs) {
  const arr = (ctxs ?? []).filter(Boolean);
  return arr.length ? `Scene: ${arr.join(" / ")}` : "Scene: any";
}


// ---------- Opportunity (Trading Encounter) ----------
function ensureOpportunityState() {
  if (!state) return;
  state.opportunity ??= {};
  if (!Number.isFinite(state.opportunity.nextAt)) {
    const base = (state.runEventIndex ?? 0);
    state.opportunity.nextAt = base + rInt(OPPORTUNITY_GAP_MIN, OPPORTUNITY_GAP_MAX);
  }
}

function shouldOfferOpportunity() {
  if (!state) return false;
  ensureOpportunityState();
  const idx = state.runEventIndex ?? 0;
  return idx >= (state.opportunity.nextAt ?? Infinity);
}

function scheduleNextOpportunity() {
  if (!state) return;
  ensureOpportunityState();
  const idx = state.runEventIndex ?? 0;
  state.opportunity.nextAt = idx + rInt(OPPORTUNITY_GAP_MIN, OPPORTUNITY_GAP_MAX);
}

function buildOpportunityTrades() {
  const t1 = {
    id: "sup_to_coin",
    title: "Supplies → Coin",
    note: "A hungry quartermaster pays less than you'd like.",
    give: { resource: "Supplies", amount: rInt(3, 5) },
    get:  { resource: "Coin",     amount: rInt(1, 3) }
  };
  const t2 = {
    id: "coin_to_sup",
    title: "Coin → Supplies",
    note: "You buy in a hurry; the seller charges for speed.",
    give: { resource: "Coin",     amount: rInt(4, 6) },
    get:  { resource: "Supplies", amount: rInt(2, 4) }
  };
  const t3 = {
    id: "sec_to_inf",
    title: "Secrets → Influence",
    note: "You trade dirt for favors—quietly, and for less than it's worth.",
    give: { resource: "Secrets",   amount: rInt(2, 3) },
    get:  { resource: "Influence", amount: rInt(1, 2) }
  };
  const t4 = {
    id: "inf_to_coin",
    title: "Influence → Coin",
    note: "A favor cashed out in haste loses its shine.",
    give: { resource: "Influence", amount: rInt(2, 3) },
    get:  { resource: "Coin",      amount: rInt(1, 2) }
  };

  const base = [t1, t2, t3];

  // Sometimes swap in Influence → Coin as one of the three offers.
  if (Math.random() < 0.35) {
    const drop = rInt(0, base.length - 1);
    base.splice(drop, 1, t4);
  }

  return base;
}

function canAffordTrade(trade) {
  const have = state?.res?.[trade.give.resource] ?? 0;
  return have >= (trade.give.amount ?? 0);
}

function applyTrade(trade) {
  if (!trade) return;
  if (!canAffordTrade(trade)) return;

  applyResourceDelta({ resource: trade.give.resource, amount: -(trade.give.amount ?? 0) });
  applyResourceDelta({ resource: trade.get.resource,  amount: +(trade.get.amount ?? 0) });

  log(`Opportunity: Traded ${trade.give.amount} ${trade.give.resource} for ${trade.get.amount} ${trade.get.resource}.`);
}

function openOpportunityModal({ onDone } = {}) {
  const trades = buildOpportunityTrades();
  let tradeMade = false;

  const wrap = document.createElement("div");
  wrap.className = "opportunityWrap";

  // Top intro + current resources (so trades/upgrades are informed).
  const intro = document.createElement("div");
  intro.innerHTML = `
    <div class="muted">A broker flags you down with practiced warmth. “Quick exchanges, clean hands. What do you need?”</div>
    <div class="spacer"></div>
  `;
  wrap.appendChild(intro);

  const resBar = document.createElement("div");
  resBar.className = "resBar";
  wrap.appendChild(resBar);

  function refreshResBar() {
    const r = state?.res ?? {};
    const scrip = state?.scrip ?? 0;
    const items = [
      ["Coin", r.Coin ?? 0],
      ["Supplies", r.Supplies ?? 0],
      ["Renown", r.Renown ?? 0],
      ["Influence", r.Influence ?? 0],
      ["Secrets", r.Secrets ?? 0],
      ["Scrip", scrip]
    ];
    resBar.innerHTML = items
      .map(([k, v]) => `<span class="chip">${k}: <b>${v}</b></span>`)
      .join("");
  }

  refreshResBar();

  // --- Trades (1 per Opportunity) ---
  const tradeHead = document.createElement("div");
  tradeHead.className = "row space";

  const tradeInfo = document.createElement("div");
  tradeInfo.innerHTML = `
    <div class="cardname">Trade</div>
    <div class="muted small">Make <b>one</b> exchange (optional). After that, you can still upgrade cards.</div>
  `;

  const tradePill = document.createElement("div");
  tradePill.className = "pill";

  tradeHead.appendChild(tradeInfo);
  tradeHead.appendChild(tradePill);
  wrap.appendChild(tradeHead);

  const grid = document.createElement("div");
  grid.className = "tradeGrid";
  wrap.appendChild(grid);

  const tradeEls = [];

  function refreshTrades() {
    tradePill.innerHTML = tradeMade ? `Trade: <b>Used</b>` : `Trade: <b>1</b> left`;
    for (const t of tradeEls) t.paint();
  }

  for (const tr of trades) {
    const div = document.createElement("div");
    div.className = "tradeOption cardbtn";

    function paint() {
      const affordable = canAffordTrade(tr);
      const disabled = tradeMade || !affordable;
      div.className = "tradeOption cardbtn" + (disabled ? " dim" : "");
      div.innerHTML = `
        <div class="cardname">${tr.title}</div>
        <div class="tradeMain">
          <span class="delta neg">↓ ${tr.give.amount} ${tr.give.resource}</span>
          <span class="muted">→</span>
          <span class="delta pos">↑ ${tr.get.amount} ${tr.get.resource}</span>
        </div>
        <div class="muted small">${tr.note}</div>
        ${tradeMade
          ? `<div class="muted small">Trade already used.</div>`
          : (affordable ? "" : `<div class="muted small">Not enough ${tr.give.resource}.</div>`)
        }
      `;
    }

    div.addEventListener("click", () => {
      if (tradeMade) return;
      if (!canAffordTrade(tr)) return;

      applyTrade(tr);
      tradeMade = true;
      saveState();
      renderAll();
      refreshResBar();
      refreshTrades();
      refreshUpgrades();
    });

    tradeEls.push({ div, paint });
    paint();
    grid.appendChild(div);
  }

  refreshTrades();

  // --- Card upgrades (Scrip) ---
  function getLevelDataAt(card, level) {
    const levels = card?.levels ?? [];
    return levels.find(x => Number(x.level ?? 1) == Number(level)) || levels[0] || { level: 1, bonus: 0, partialOnFail: false };
  }

  function cardRiderTextAt(card, lvlData) {
    if (!card) return "";

    if (isWildCard(card)) {
      const t = bundleInlineSummary(lvlData?.onPlay);
      return t ? `Use anytime • ${t}` : "Use anytime";
    }

    const onS = bundleInlineSummary(lvlData?.onSuccess);
    const onF = bundleInlineSummary(lvlData?.onFailure);
    const parts = [];
    if (onS) parts.push(`✓ ${onS}`);
    if (onF) parts.push(`✗ ${onF}`);
    return parts.join(" / ");
  }

  function cardLineAt(card, level) {
    const lvlData = getLevelDataAt(card, level);
    const isWild = isWildCard(card);

    const arrowsText = isWild ? "✦" : (arrowsForBonus(lvlData.bonus) || "—");
    const arrowsClass = isWild
      ? "muted"
      : (arrowsForBonus(lvlData.bonus) ? (lvlData.bonus >= 0 ? "good" : "bad") : "muted");

    const riderText = cardRiderTextAt(card, lvlData);
    const scenesText = cardScenesText(card);
    const line3 = isWild
      ? riderText
      : ([scenesText, riderText].filter(Boolean).join(" • ") + (lvlData.partialOnFail ? " • partial on failure" : ""));

    return { arrowsText, arrowsClass, line3 };
  }

  const upWrap = document.createElement("div");
  upWrap.className = "upgradeWrap";

  const upTop = document.createElement("div");
  upTop.className = "row space";

  const upInfo = document.createElement("div");
  upInfo.innerHTML = `
    <div class="spacer"></div>
    <div class="cardname">Upgrade Cards</div>
    <div class="muted small">Spend Scrip to upgrade cards in your current deck. Upgrade as many times as you can afford.</div>
  `;

  const scripPill = document.createElement("div");
  scripPill.className = "pill";

  upTop.appendChild(upInfo);
  upTop.appendChild(scripPill);

  const list = document.createElement("div");
  list.className = "upgradeList";

  upWrap.appendChild(upTop);
  upWrap.appendChild(list);
  wrap.appendChild(upWrap);

  function refreshUpgrades() {
    scripPill.innerHTML = `Scrip: <b>${state.scrip ?? 0}</b>`;

    // Stable list: unique card ids, sorted by name.
    const allIds = Array.from(new Set([...(state.masterDeck ?? []), ...(state.drawPile ?? []), ...(state.discardPile ?? [])]));
    allIds.sort((a, b) => {
      const A = DATA.cardsById[a]?.name ?? a;
      const B = DATA.cardsById[b]?.name ?? b;
      return A.localeCompare(B);
    });

    list.innerHTML = "";

    for (const cid of allIds) {
      const c = DATA.cardsById[cid];
      if (!c) continue;

      const cur = (state.cardLevels?.[cid] ?? 1);
      const maxLvl = maxCardLevel(c);
      const rarity = c.rarity ?? "Common";
      const costTable = UPGRADE_COSTS[rarity] ?? UPGRADE_COSTS.Common;
      const cost = costTable[cur] ?? costTable[costTable.length - 1] ?? 10;

      const canUp = cur < maxLvl;
      const canPay = (state.scrip ?? 0) >= cost;

      const curLine = cardLineAt(c, cur);
      const nextLine = canUp ? cardLineAt(c, cur + 1) : null;

      const row = document.createElement("div");
      row.className = "upgradeRow";

      row.innerHTML = `
        <div class="upgradeInfo">
          <div class="upgradeName">${c.name}</div>
          <div class="muted small">${rarity} • ${c.discipline} • Level ${cur}${canUp ? ` → ${cur + 1}` : " (Max)"}</div>

          <div class="upgradeEffect">
            <div class="small"><span class="muted">Current:</span>
              <span class="arrows ${curLine.arrowsClass}">${curLine.arrowsText}</span>
              <span>${curLine.line3 || "—"}</span>
            </div>
            ${nextLine ? `
              <div class="small"><span class="muted">Next:</span>
                <span class="arrows ${nextLine.arrowsClass}">${nextLine.arrowsText}</span>
                <span>${nextLine.line3 || "—"}</span>
              </div>
            ` : ``}
          </div>
        </div>

        <button class="btn small ${canUp && canPay ? "primary" : "ghost"}" ${canUp && canPay ? "" : "disabled"}>
          ${canUp ? `Upgrade (-${cost})` : "Max"}
        </button>
      `;

      const btn = row.querySelector("button");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!canUp) return;
        const res = tryUpgradeCard(cid);
        if (!res.ok) return;
        log(res.msg);
        renderAll();
        refreshResBar();
        refreshUpgrades();
      });

      list.appendChild(row);
    }
  }

  refreshUpgrades();

  // --- Continue (advance to next event) ---
  const actions = document.createElement("div");
  actions.className = "modalActions";

  const leave = document.createElement("button");
  leave.className = "btn primary";
  leave.textContent = "Continue";
  leave.addEventListener("click", () => {
    scheduleNextOpportunity();
    saveState();

    modalLocked = false;
    closeModal();
  });

  actions.appendChild(leave);
  wrap.appendChild(document.createElement("div")).className = "spacer";
  wrap.appendChild(actions);

  openModal("Opportunity", wrap, { locked: true, onClose: () => { onDone?.(); } });
}

let creation = {
  bgId: null,
  ambitionId: null,
  alloc: Object.fromEntries(STATS.map(s => [s, 0])),
  traits: new Set()
};

function generateHeirNameChoices(n = 5) {
  const pool = [...HEIR_NAMES];
  shuffle(pool);
  return pool.slice(0, n);
}

function fmtDelta(n) {
  if (!n) return "0";
  return (n > 0 ? `+${n}` : `${n}`);
}

function summarizeBundle(bundle) {
  const lines = [];
  if (!bundle) return lines;

  for (const d of (bundle.resources ?? [])) {
    const amt = d.amount ?? 0;
    if (amt === 0) continue;
    lines.push(`${d.resource}: ${fmtDelta(amt)}`);
  }

  for (const c of (bundle.conditions ?? [])) {
    if (!isDisplayConditionId(c.id)) continue;
    const sev = c.severity ?? "Minor";
    if (c.mode === "Add") lines.push(`Condition gained: ${c.id} (${sev})`);
    if (c.mode === "Remove") lines.push(`Condition removed: ${c.id}`);
    if (c.mode === "Downgrade") lines.push(`Condition eased: ${c.id}`);
    if (c.mode === "Upgrade") lines.push(`Condition worsened: ${c.id}`);
  }

  for (const f of (bundle.flags ?? [])) {
    if (f.mode === "Add") lines.push(`Flag gained: ${f.id}`);
    if (f.mode === "Remove") lines.push(`Flag cleared: ${f.id}`);
  }

  for (const s of (bundle.standings ?? [])) {
    const steps = s.steps ?? 0;
    if (steps !== 0) lines.push(`Standing ${s.factionId}: ${steps > 0 ? "+" : ""}${steps} tier(s)`);
  }

  return lines;
}

function isDisplayConditionId(id) {
  // Hide internal "pseudo-conditions" like rival_pressure / rumor_shield.
  // Real conditions in this prototype are TitleCase.
  return typeof id === "string" && /^[A-Z]/.test(id);
}

function renderResultBadges(bundle) {
  const wrap = document.createElement("div");
  wrap.className = "resultBadges";

  if (!bundle) return wrap;

  // Resources (only core resources)
  for (const d of (bundle.resources ?? [])) {
    const amt = d.amount ?? 0;
    if (!amt) continue;
    if (!RES.includes(d.resource)) continue;

    const pill = document.createElement("span");
    pill.className = "resultPill " + (amt > 0 ? "good" : "bad");
    pill.textContent = `${amt > 0 ? "↑" : "↓"} ${Math.abs(amt)} ${d.resource}`;
    wrap.appendChild(pill);
  }

  // Conditions (displayable only)
  for (const c of (bundle.conditions ?? [])) {
    if (!isDisplayConditionId(c.id)) continue;

    const mode = c.mode ?? "Add";
    const sev = c.severity ?? "Minor";

    const pill = document.createElement("span");

    if (mode === "Add") {
      pill.className = "resultPill bad";
      pill.textContent = `↓ ${c.id} (${sev})`;
    } else if (mode === "Remove") {
      pill.className = "resultPill good";
      pill.textContent = `↑ Remove ${c.id}`;
    } else if (mode === "Downgrade") {
      pill.className = "resultPill good";
      pill.textContent = `↑ Ease ${c.id}`;
    } else if (mode === "Upgrade") {
      pill.className = "resultPill bad";
      pill.textContent = `↓ ${c.id} (${sev})`;
    } else {
      pill.className = "resultPill";
      pill.textContent = `${mode}: ${c.id}`;
    }

    wrap.appendChild(pill);
  }


  // Standings
  for (const s of (bundle.standings ?? [])) {
    const steps = s.steps ?? 0;
    if (!steps) continue;
    const pill = document.createElement("span");
    pill.className = "resultPill " + (steps > 0 ? "good" : "bad");
    pill.textContent = `${steps > 0 ? "↑" : "↓"} ${factionLabel(s.factionId)} ${Math.abs(steps)} tier`;
    wrap.appendChild(pill);
  }

  return wrap;
}

function summarizeBundleForPlayer(bundle) {
  const resources = [];
  const conditions = [];
  if (!bundle) return { resources, conditions };

  for (const d of (bundle.resources ?? [])) {
    const amt = d.amount ?? 0;
    if (!amt) continue;
    resources.push(`${d.resource}: ${fmtDelta(amt)}`);
  }

  for (const c of (bundle.conditions ?? [])) {
    if (!isDisplayConditionId(c.id)) continue;
    const sev = c.severity ?? "Minor";
    if (c.mode === "Add") conditions.push(`Gained: ${c.id} (${sev})`);
    if (c.mode === "Remove") conditions.push(`Removed: ${c.id}`);
    if (c.mode === "Downgrade") conditions.push(`Eased: ${c.id}`);
    if (c.mode === "Upgrade") conditions.push(`Worsened: ${c.id} (${sev})`);
  }

  return { resources, conditions };
}

function defaultResultNarrative(ev, outcome, success, partial) {
  const ctx = (ev?.context ?? "").toLowerCase();
  const opener =
    ctx === "court"  ? "In the hush of the hall," :
    ctx === "scheme" ? "In whispered corners," :
    ctx === "journey"? "On the road," :
    ctx === "strife" ? "In the clash and scramble," :
    ctx === "lore"   ? "By lamplight," :
                       "In the moment,";

  const prompt = String(ev?.prompt ?? "").trim().replace(/\s+/g, " ");
  let hook = prompt;
  const m = prompt.match(/^(.+?[.!?])\s/);
  if (m) hook = m[1];
  if (hook.length > 140) hook = hook.slice(0, 137) + "…";

  const choice = outcome?.title ? `“${outcome.title}”` : "your choice";

  if (partial) return `${opener} ${hook} You don’t quite get what you wanted, but you salvage something from ${choice}.`;
  if (success) return `${opener} ${hook} ${choice} lands cleanly, and the consequences fall your way.`;
  return `${opener} ${hook} ${choice} carries a cost, and you feel it immediately.`;
}

function openResultModal({ title, subtitle, narrative, resources, conditions, locked = false, onClose }) {
  const wrap = document.createElement("div");

  if (subtitle) {
    const sub = document.createElement("div");
    sub.className = "muted";
    sub.style.marginBottom = "8px";
    sub.textContent = subtitle;
    wrap.appendChild(sub);
  }

  if (narrative) {
    const p = document.createElement("div");
    p.style.marginBottom = "10px";
    p.textContent = narrative;
    wrap.appendChild(p);
  }

  const hasRes = Array.isArray(resources) && resources.length > 0;
  const hasConds = Array.isArray(conditions) && conditions.length > 0;

  if (!hasRes && !hasConds) {
    const none = document.createElement("div");
    none.className = "muted";
    none.textContent = "No changes.";
    wrap.appendChild(none);
  } else {
    if (hasRes) {
      const h = document.createElement("div");
      h.className = "muted";
      h.style.margin = "6px 0 4px";
      h.textContent = "Resources";
      wrap.appendChild(h);

      const ul = document.createElement("ul");
      ul.style.margin = "0 0 6px";
      ul.style.paddingLeft = "18px";
      for (const l of resources) {
        const li = document.createElement("li");
        li.textContent = l;
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
    }

    if (hasConds) {
      const h = document.createElement("div");
      h.className = "muted";
      h.style.margin = "6px 0 4px";
      h.textContent = "Conditions";
      wrap.appendChild(h);

      const ul = document.createElement("ul");
      ul.style.margin = "0";
      ul.style.paddingLeft = "18px";
      for (const l of conditions) {
        const li = document.createElement("li");
        li.textContent = l;
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
    }
  }

  openModal(title, wrap, { locked, onClose });
}

function openSuccessionModal(onConfirm) {
  const wrap = document.createElement("div");

  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = "Your heir rises. Choose their name and focus.";
  wrap.appendChild(p);

  // Name choices
  const names = generateHeirNameChoices(5);
  const nameGrid = document.createElement("div");
  nameGrid.className = "hand";
  wrap.appendChild(nameGrid);

  let chosenName = null;
  let chosenFocus = null;

  function updateConfirm() {
    btnConfirm.disabled = !(chosenName && chosenFocus);
  }

  for (const nm of names) {
    const b = document.createElement("div");
    b.className = "cardbtn";
    b.tabIndex = 0;
    b.innerHTML = `<div class="cardname">${nm} ${state.familyName}</div><div class="muted">Choose name</div>`;
    const pickName = () => {
      chosenName = nm;
      [...nameGrid.children].forEach(x => x.classList.remove("committed"));
      b.classList.add("committed");
      updateConfirm();
    };
    b.addEventListener("click", pickName);
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") pickName(); });
    nameGrid.appendChild(b);
  }

  // Focus select
  const focusWrap = document.createElement("div");
  focusWrap.style.marginTop = "10px";
  focusWrap.innerHTML = `<div class="muted">Heir Focus (gain +1 to this stat now):</div>`;
  const sel = document.createElement("select");
  sel.className = "inp";
  for (const s of STATS) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => {
    chosenFocus = sel.value;
    updateConfirm();
  });
  chosenFocus = sel.value;
  focusWrap.appendChild(sel);
  wrap.appendChild(focusWrap);

  // Confirm
  const btnConfirm = document.createElement("button");
  btnConfirm.className = "btn";
  btnConfirm.textContent = "Crown the Heir";
  btnConfirm.style.marginTop = "12px";
  btnConfirm.disabled = true;
  btnConfirm.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    onConfirm(chosenName, chosenFocus);
  });

  wrap.appendChild(btnConfirm);

  openModal("Succession", wrap, { locked: true });
}


// Modal
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const btnModalClose = document.getElementById("btnModalClose");

// ---------- State ----------
let state = null;
let currentEvent = null;
let selectedOutcomeIndex = null;
let hand = [];        // [{ iid, cid }]
let committed = [];   // [iid, iid]
let nextHandIid = 1;

let showChanceDetails = false;

let resolvingOutcome = false; // prevents double-advances / modal-close weirdness

function getHandEntry(iid) {
  return hand.find(h => h.iid === iid) || null;
}

function committedCardIds() {
  return committed
    .map(iid => getHandEntry(iid)?.cid)
    .filter(Boolean);
}


// ---------- Persistence ----------
const SAVE_KEY = "heirloom_runstate_v01";

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try { state = JSON.parse(raw); return true; }
  catch { return false; }
}

// ---------- Mortality ----------
function baseMortalityByAge(age) {
  // Design doc alignment:
  // 16–29: 1%, 30–39: 3%, 40–49: 6%, 50–59: 12%, 60+: 20%
  if (age <= 29) return 1;
  if (age <= 39) return 3;
  if (age <= 49) return 6;
  if (age <= 59) return 12;
  return 20;
}

function conditionMortalityBonus(cond) {
  const minor = cond.severity === "Minor";
  switch (cond.id) {
    case "Cursed":   return minor ? 1 : 10;
    case "Starving": return minor ? 1 : 8;
    case "Wounded":  return minor ? 1 : 8;
    default:         return minor ? 1 : 6;
  }
}

function computeMortalityChance() {
  let chance = baseMortalityByAge(state.age);
  for (const c of state.conditions) chance += conditionMortalityBonus(c);
  chance -= (MORTALITY_RESOLVE_MULT * (state.stats.Resolve ?? 0));
  return Math.max(0, chance);
}

// ---------- Data loading ----------
async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.json();
}

// Some hosts place JSON at the repo root instead of /data.
// Try multiple candidate paths so deployments are less fragile.
async function fetchJsonAny(paths) {
  let lastErr = null;
  for (const p of paths) {
    try {
      return await fetchJson(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw (lastErr ?? new Error("Failed to load JSON"));
}


// ---------- Ambitions (Personal goals) ----------
function normalizeAmbitionsJson(raw) {
  const meta = {
    enabled: false,
    version: null,
    updated: null,
    notes: [],
    objectiveTypes: null
  };

  if (!raw) return { meta, ambitions: [] };

  // Allow the "just an array" legacy form: [{id,name,...}]
  if (Array.isArray(raw)) {
    meta.enabled = raw.length > 0;
    return { meta, ambitions: raw };
  }

  if (typeof raw !== "object") return { meta, ambitions: [] };

  meta.version = raw.version ?? null;
  meta.updated = raw.updated ?? null;
  meta.notes = Array.isArray(raw.notes) ? raw.notes : [];
  meta.objectiveTypes = (raw.objectiveTypes && typeof raw.objectiveTypes === "object") ? raw.objectiveTypes : null;

  const ambitions = Array.isArray(raw.ambitions) ? raw.ambitions : [];
  meta.enabled = ambitions.length > 0;
  return { meta, ambitions };
}

function indexData() {
  DATA.cardsById = Object.fromEntries(DATA.cards.map(c => [c.id, c]));
  DATA.eventsById = Object.fromEntries(DATA.events.map(e => [e.id, e]));
  DATA.backgroundsById = Object.fromEntries(DATA.backgrounds.map(b => [b.id, b]));
  DATA.factionsById = Object.fromEntries((DATA.factions ?? []).map(f => [f.id, f]));
}

async function loadAllData() {
  const [cards, events, backgrounds, factions] = await Promise.all([
    fetchJsonAny(["./data/cards.json", "./cards.json"]),
    fetchJsonAny(["./data/events.json", "./events.json"]),
    fetchJsonAny(["./data/backgrounds.json", "./backgrounds.json"]),
    fetchJsonAny(["./data/factions.json", "./factions.json"]).catch(() => ([]))
  ]);

  DATA.cards = cards;
  // Restore 3-level upgrade loop even when JSON cards only define a single baseline level.
  ensureThreeLevelCards(DATA.cards);
  DATA.events = events;
  DATA.backgrounds = backgrounds;
  DATA.factions = (Array.isArray(factions) && factions.length) ? factions : DEFAULT_FACTIONS;
  indexData();
  annotateEventSignals();
  DATA.storylineMetaById = null; // rebuilt lazily

  // Minimal validation (helps catch typos early)
  for (const bg of DATA.backgrounds) {
    const deckIds = expandDeck(bg.deck);
    for (const cid of deckIds) {
      if (!DATA.cardsById[cid]) console.warn(`Background ${bg.id} references missing cardId: ${cid}`);
    }
  }
  for (const ev of DATA.events) {
    const n = ev.outcomes?.length ?? 0;
    if (n < 2 || n > 5) {
      console.warn(`Event ${ev.id} should have 2–5 outcomes (has ${n}).`);
    }
  }
}

// ---------- Requirements ----------

function factionLabel(fid) {
  const f = DATA?.factionsById?.[fid];
  return (f?.short || f?.name || fid);
}
function tierIndex(tier) {
  const i = TIERS.indexOf(tier);
  return i >= 0 ? i : 2; // default Neutral
}

function hasCondition(id, severity = null) {
  id = normalizeConditionId(id);
  const c = state.conditions.find(x => x.id === id);
  if (!c) return false;

  if (!severity || severity === "Any") return true;
  return c.severity === severity;
}

function checkRequirement(req) {
  const t = req.type;

  if (t === "MinStat") {
    const v = state.stats[req.stat] ?? 0;
    let need = (req.min ?? 0);
    // Content is authored on the old 0–5 scale; internally we now use 0–10.
    // Double any <=5 thresholds unless the requirement opts out via { unscaled: true }.
    if (STAT_CAP === 10 && !req.unscaled && need <= 5) need = need * STAT_SCALE;
    return v >= need;
  }
  if (t === "MinResource") {
    const v = state.res[req.resource] ?? 0;
    return v >= (req.min ?? 0);
  }
  if (t === "HasCondition") return hasCondition(req.id, req.severity ?? "Any");
  if (t === "NotCondition") return !hasCondition(req.id, req.severity ?? "Any");
  if (t === "HasFlag") return hasFlag(req.id);
  if (t === "NotFlag") return !hasFlag(req.id);
  if (t === "AgeRange") return state.age >= (req.min ?? 0) && state.age <= (req.max ?? 999);
  if (t === "MinStanding") {
    const cur = state.standings?.[req.factionId] ?? "Neutral";
    return tierIndex(cur) >= tierIndex(req.minTier ?? "Neutral");
  }

  // Unknown requirement types are treated as unmet to avoid accidental bypass
  return false;
}

function unmetReasons(requirements) {
  if (!requirements || requirements.length === 0) return [];
  const reasons = [];
  for (const req of requirements) {
    if (checkRequirement(req)) continue;

    // Human-readable reasons
    switch (req.type) {
      case "MinStat":
        reasons.push(`Requires ${req.stat} ≥ ${req.min}`);
        break;
      case "MinResource":
        reasons.push(`Requires ${req.resource} ≥ ${req.min}`);
        break;
      case "HasCondition":
        reasons.push(`Requires ${req.id}${req.severity && req.severity !== "Any" ? ` (${req.severity})` : ""}`);
        break;
      case "NotCondition":
        reasons.push(`Blocked by ${req.id}${req.severity && req.severity !== "Any" ? ` (${req.severity})` : ""}`);
        break;
      case "HasFlag":
        reasons.push(`Locked: your earlier choices didn't open this path.`);
        break;
      case "NotFlag":
        reasons.push(`Locked: your earlier choices closed this path.`);
        break;
      case "AgeRange":
        reasons.push(`Requires age ${req.min}–${req.max}`);
        break;
      case "MinStanding":
        reasons.push(`Requires ${req.factionId} standing ≥ ${req.minTier}`);
        break;
      default:
        reasons.push(`Requirement unmet: ${req.type}`);
        break;
    }
  }
  return reasons;
}

// ---------- Deck ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rarityWeight(rarity) {
  switch (rarity) {
    case "Common": return 10;
    case "Uncommon": return 3;
    case "Rare": return 1;
    default: return 3;
  }
}

function weightedPickCardId(excludeSet) {
  let total = 0;
  const weighted = [];

  for (const c of DATA.cards) {
    if (excludeSet.has(c.id)) continue;
    const w = rarityWeight(c.rarity);
    total += w;
    weighted.push({ id: c.id, w });
  }

  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const entry of weighted) {
    roll -= entry.w;
    if (roll <= 0) return entry.id;
  }
  return weighted[weighted.length - 1]?.id ?? null;
}


function generateDraftChoices(n = 3) {
  const choices = [];
  const exclude = new Set();
  while (choices.length < n) {
    const id = weightedPickCardId(exclude);
    if (!id) break;
    choices.push(id);
    exclude.add(id);
  }

  // Small "pity" rule: if the draft rolled all-Common, upgrade one slot if possible.
  const hasNonCommon = choices.some(id => (DATA.cardsById[id]?.rarity ?? "Common") !== "Common");
  if (choices.length && !hasNonCommon) {
    const pool = (DATA.cards ?? [])
      .filter(c => c && (c.rarity ?? "Common") !== "Common" && !exclude.has(c.id))
      .map(c => c.id);
    if (pool.length) {
      choices[choices.length - 1] = pick(pool);
    }
  }

  return choices;
}


function openDraftModal(onPicked) {
  const choices = generateDraftChoices(3);
  if (!choices.length) {
    console.warn("Draft had no card choices. Skipping draft to avoid softlock.");
    if (typeof onPicked === "function") onPicked(null);
    return;
  }


  const wrap = document.createElement("div");
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = "Major milestone! Choose 1 card to add to your deck (it goes into your discard pile).";

  const p2 = document.createElement("p");
  p2.className = "muted small";
  p2.textContent = "Click a card to choose."; 
  wrap.appendChild(p2);
  wrap.appendChild(p);

  const list = document.createElement("div");
  list.className = "hand";
  wrap.appendChild(list);

  for (const cid of choices) {
    const c = DATA.cardsById[cid];
    const lvlData = getCardLevelData(c);
    const isWild = isWildCard(c);
    const arrowsText = isWild ? "✦" : (arrowsForBonus(lvlData.bonus) || "—");
    const arrowsClass = isWild ? "muted" : (arrowsForBonus(lvlData.bonus) ? (lvlData.bonus >= 0 ? "good" : "bad") : "muted");
    const rarityMark = cardRarityMark(c);
    const riderText = cardRiderText(c);
    const scenesText = cardScenesText(c);
    const line3 = isWild ? riderText : ([scenesText, riderText].filter(Boolean).join(" • ") + (lvlData.partialOnFail ? " • partial on failure" : ""));

    const div = document.createElement("div");
    div.className = "cardbtn";
    div.tabIndex = 0;
    div.dataset.rarity = (c.rarity || "");
    div.dataset.discipline = (c.discipline || "");

    div.innerHTML = `
      <div class="cardname">${c.name}</div>
      <div class="cardtype"><span>${c.discipline}</span><span class="rarityPips">${rarityMark}</span></div>

      <div class="cardbig">
        <span class="arrows ${arrowsClass}">${arrowsText}</span>
        <span class="cardbigtext">${line3}</span>
      </div>

      <div class="cardflavor"><em>${cardFlavor(c)}</em></div>
    `;

    const choose = () => {
      state.discardPile.push(cid);
      if (Array.isArray(state.masterDeck)) state.masterDeck.push(cid);
      log(`Draft reward chosen: ${c.name}.`);
      saveState();
      renderAll();
      modalLocked = false;
      closeModal();
      onPicked?.();
    };

    div.addEventListener("click", choose);
    div.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") choose(); });

    list.appendChild(div);
  }

  openModal("Draft Reward", wrap, { locked: true });
}

function expandDeck(deckField) {
  // supports:
  // - ["id","id"...]
  // - [{cardId:"id", count:2}, ...]
  if (!deckField) return [];
  if (Array.isArray(deckField) && typeof deckField[0] === "string") return [...deckField];

  if (Array.isArray(deckField) && typeof deckField[0] === "object") {
    const out = [];
    for (const entry of deckField) {
      const count = Math.max(1, entry?.count ?? 1);
      const id = entry?.cardId ?? entry?.id;
      if (!id) continue;
      for (let i = 0; i < count; i++) out.push(id);
    }
    return out;
  }

  return [];
}

function normalizeStarterDeck(deckIds) {
  // Replace non-common (and Wild) placeholders with Commons of the same discipline.
  // This prevents backgrounds from "starting" with Uncommon/Rare in the prototype.
  const commonsByDisc = {};
  for (const c of (DATA.cards ?? [])) {
    if (c?.rarity !== "Common") continue;
    if (isWildCard(c)) continue;
    const d = c.discipline ?? "Unknown";
    (commonsByDisc[d] ||= []).push(c.id);
  }

  const out = [];
  for (const cid of (deckIds ?? [])) {
    const c = DATA.cardsById[cid];
    if (!c) continue;

    if (c.rarity === "Common" && !isWildCard(c)) {
      out.push(cid);
      continue;
    }

    const pool = commonsByDisc[c.discipline ?? "Unknown"] || [];
    if (!pool.length) { out.push(cid); continue; }

    const rep = pool[Math.abs(hash32(cid)) % pool.length];
    out.push(rep);
  }
  return out;
}


function ensureDeckIntegrity(reason = "") {
  if (!state) return;

  state.drawPile = Array.isArray(state.drawPile) ? state.drawPile : [];
  state.discardPile = Array.isArray(state.discardPile) ? state.discardPile : [];
  state.masterDeck = Array.isArray(state.masterDeck) ? state.masterDeck : [];

  // If masterDeck is missing, rebuild from whatever cards exist.
  if (state.masterDeck.length === 0) {
    const combined = [...state.drawPile, ...state.discardPile];
    if (combined.length) state.masterDeck = [...combined];
  }

  // If both piles are empty but we have a master deck, refill draw pile.
  if (state.drawPile.length === 0 && state.discardPile.length === 0 && state.masterDeck.length) {
    state.drawPile = shuffle([...state.masterDeck]);
    state.discardPile = [];
    if (reason) console.warn("Deck integrity refill:", reason);
  }
}


function drawHand(n) {
  ensureDeckIntegrity("drawHand:start");
  hand = [];
  for (let i = 0; i < n; i++) {
    if (state.drawPile.length === 0) {
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [];

      // If both piles are empty, rebuild from masterDeck.
      ensureDeckIntegrity("drawHand:reshuffle-empty");
      if (state.drawPile.length === 0) break;
    }
    const cid = state.drawPile.pop();
    hand.push({ iid: nextHandIid++, cid });
  }
}


function drawOneCardIntoHand() {
  if (!state) return null;
  ensureDeckIntegrity("drawOneCard:start");
  if (state.drawPile.length === 0) {
    state.drawPile = shuffle(state.discardPile);
    state.discardPile = [];
    ensureDeckIntegrity("drawOneCard:reshuffle-empty");
    if (state.drawPile.length === 0) return null;
  }
  const cid = state.drawPile.pop();
  const entry = { iid: nextHandIid++, cid };
  hand.push(entry);
  return entry;
}

function playWildCard(iid) {
  if (resolvingOutcome) return;
  const idx = hand.findIndex(x => x.iid === iid);
  if (idx === -1) return;
  const cid = hand[idx].cid;
  const card = DATA.cardsById[cid];
  if (!isWildCard(card)) return;

  const lvl = getCardLevelData(card);
  const bundle = lvl.onPlay;

  // Consume the card.
  state.discardPile.push(cid);
  hand.splice(idx, 1);

  // Apply its immediate effect.
  if (bundle) applyBundle(bundle);

  // Replace the slot immediately.
  drawOneCardIntoHand();

  log(`Used: ${card.name}`);

  // Keep the same event; just refresh UI + highlights.
  saveState();
  renderAll();
}

function handSizeForEvent(ev) {
  let n = 4;

  // Conditions should squeeze your options a bit, but not hard-lock you.
  if (ev?.context === "Strife" && (hasCondition("Wounded") || hasCondition("Bruised"))) n = Math.min(n, 3);
  if ((ev?.context === "Journey" || ev?.context === "Strife") && hasCondition("Starving")) n = Math.min(n, 3);
  if ((ev?.context === "Journey" || ev?.context === "Lore") && hasCondition("Ill")) n = Math.min(n, 3);
  if (ev?.context === "Court" && hasCondition("Wanted")) n = Math.min(n, 3);

  return n;
}

// ---------- Cards ----------
function getCardLevel(cardId) {
  return (state?.cardLevels?.[cardId] ?? 1);
}

function getCardLevelData(card) {
  const lvl = getCardLevel(card.id);
  const levels = card.levels ?? [];
  const found = levels.find(x => x.level === lvl) || levels[0];
  return found || { level: 1, bonus: 0, partialOnFail: false };
}


function bundleFromCommittedCards(committedCids, key) {
  let out = null;
  for (const cid of (committedCids ?? [])) {
    const c = DATA.cardsById[cid];
    if (!c) continue;
    const lvl = getCardLevelData(c);
    const b = lvl?.[key];
    if (!b) continue;
    // Treat empty objects as "no bundle"
    const hasRes = Array.isArray(b.resources) && b.resources.length;
    const hasCon = Array.isArray(b.conditions) && b.conditions.length;
    if (!hasRes && !hasCon) continue;
    out = mergeBundles(out, b);
  }
  return out;
}

function isCardUsable(cardId, outcomeIndex) {
  const card = DATA.cardsById[cardId];
  const o = currentEvent?.outcomes?.[outcomeIndex];
  if (!card || !o) return false;


  if (isWildCard(card)) return true;

  const contextOk = (card.contexts ?? []).includes(currentEvent.context);
  const disciplineOk = (o.allowed ?? []).includes(card.discipline);

  return contextOk && disciplineOk;
}

function cardUsabilityDetails(cardId, outcomeIndex) {
  const card = DATA.cardsById[cardId];
  const o = currentEvent?.outcomes?.[outcomeIndex];
  if (!card || !o) {
    return { playable: false, isWild: false, sceneOk: false, allowedOk: false, reason: "Unavailable" };
  }

  const isWild = isWildCard(card);
  if (isWild) {
    return { playable: true, isWild: true, sceneOk: true, allowedOk: true, reason: "Wild — usable anytime." };
  }

  const sceneOk = (card.contexts ?? []).includes(currentEvent.context);
  const allowedOk = (o.allowed ?? []).includes(card.discipline);
  const playable = sceneOk && allowedOk;

  let reason = "";
  if (playable) reason = `Playable (${currentEvent.context} + ${card.discipline})`;
  else if (!sceneOk && !allowedOk) reason = `Not usable (needs ${currentEvent.context} and ${(o.allowed ?? []).join("/")})`;
  else if (!sceneOk) reason = `Wrong scene (needs ${currentEvent.context})`;
  else reason = `Not allowed (needs ${(o.allowed ?? []).join("/")})`;

  return { playable, isWild, sceneOk, allowedOk, reason };
}

function countCommitReadyCardsForOutcome(outcomeIndex) {
  if (outcomeIndex == null) return 0;
  let n = 0;
  for (const entry of (hand ?? [])) {
    const cid = entry?.cid;
    const c = DATA.cardsById[cid];
    if (!c) continue;
    if (isWildCard(c)) continue; // counts exclude Wild
    if (isCardUsable(cid, outcomeIndex)) n++;
  }
  return n;
}

function countWildCardsInHand() {
  let n = 0;
  for (const entry of (hand ?? [])) {
    const c = DATA.cardsById[entry?.cid];
    if (c && isWildCard(c)) n++;
  }
  return n;
}



function cardLabel(cardId) {
  const c = DATA.cardsById[cardId];
  if (!c) return cardId;
  const lvlData = getCardLevelData(c);
  const arrows = arrowsForBonus(lvlData.bonus);
  return arrows ? `${c.name} ${arrows}` : c.name;
}

// ---------- Effects ----------
function ensureStateMaps() {
  state.flags ??= {};      // { flagId: remainingEvents }
  state.standings ??= {};  // { factionId: tier }
  state.history ??= { recentEvents: [], recentContexts: [], seen: {} };
}


function hasFlag(id) {
  if (!state) return false;
  ensureStateMaps();
  return Object.prototype.hasOwnProperty.call(state.flags, id);
}

function applyResourceDelta(d) {
  if (!d) return;
  const k = d.resource;
  const amt = d.amount ?? 0;

  const before = state.res[k] ?? 0;
  const after = clamp(before + amt, 0, 99);
  state.res[k] = after;

  // Resource floor consequences (only when crossing from >0 to 0 due to a loss).
  // These don't kill you directly; they add pressure conditions.
  if (before > 0 && after === 0 && amt < 0) {
    if (k === "Coin") addCondition("In Debt", "Minor", { source: "floor" });
    if (k === "Supplies") {
      // Starving is dangerous, but we ease into it: first you're hungry (Minor),
      // then it can worsen if you stay at 0.
      ensureCondMeta();
      state.condMeta.starveMisses = 0;
      addCondition("Starving", "Minor", { source: "floor" });
    }
    if (k === "Renown") addCondition("Disgraced", "Minor", { source: "floor" });
  }
}

function findConditionIndex(id) {
  return state.conditions.findIndex(c => c.id === id);
}



function normalizeConditionId(id) {
  // Back-compat for older data.
  if (id === "InDebt") return "In Debt";
  return id;
}

function defaultConditionDurationEvents(id, severity) {
  id = normalizeConditionId(id);
  // Duration is expressed in *events* (2 events = 1 year).
  // Return 0 for no timer.
  if (id === "Bruised" && severity === "Minor") return 2;
  if (id === "Exhausted" && severity === "Minor") return 2;
  if (id === "Ill" && severity === "Minor") return 4;
  if (id === "Ill" && severity === "Severe") return 6;
  return 0;
}

function ensureConditionShapes() {
  // Ensure saved runs from older builds don't break.
  state.conditions ??= [];
  const now = state.runEventIndex ?? 0;
  for (const c of state.conditions) {
    c.id = normalizeConditionId(c.id);
    if (c.expiresAt != null && !Number.isFinite(c.expiresAt)) delete c.expiresAt;
    // If a timed condition existed without expiresAt (older data), keep it untimed rather than guessing.
    if (c.expiresAt != null && c.expiresAt < now) delete c.expiresAt;
  }
}

function hasCondition(id, severity = null) {
  id = normalizeConditionId(id);
  const c = state.conditions.find(x => x.id === id);
  if (!c) return false;
  if (!severity) return true;
  return c.severity === severity;
}

function getCondition(id) {
  id = normalizeConditionId(id);
  return state.conditions.find(x => x.id === id) || null;
}

function conditionSeverity(id) {
  const c = getCondition(id);
  return c ? c.severity : null;
}

function addCondition(id, severity, opts = {}) {
  id = normalizeConditionId(id);
  const idx = findConditionIndex(id);
  const now = state.runEventIndex ?? 0;

  let durationEvents = opts.durationEvents ?? defaultConditionDurationEvents(id, severity);
  if (!Number.isFinite(durationEvents) || durationEvents <= 0) durationEvents = 0;

  // Special: Wounded (Severe) heals into Bruised if you survive long enough.
  let expiresMode = opts.expiresMode ?? null; // "Remove" | "DowngradeTo"
  let expiresTo = opts.expiresTo ?? null;
  if (id === "Wounded" && severity === "Severe" && !opts.expiresMode && !opts.expiresTo) {
    durationEvents = 6; // ~3 years (since 2 events = 1 year)
    expiresMode = "DowngradeTo";
    expiresTo = "Bruised";
  }

  const expiresAt = durationEvents ? (now + durationEvents) : null;

  if (idx === -1) {
    const c = { id, severity };
    if (expiresAt) c.expiresAt = expiresAt;
    if (expiresMode) c.expiresMode = expiresMode;
    if (expiresTo) c.expiresTo = expiresTo;
    if (opts.source) c.source = opts.source;
    state.conditions.push(c);
  } else {
    const cur = state.conditions[idx];
    if (cur.severity === "Minor" && severity === "Severe") cur.severity = "Severe";
    if (expiresAt) {
      if (!cur.expiresAt || expiresAt > cur.expiresAt) cur.expiresAt = expiresAt;
    }
    if (expiresMode) cur.expiresMode = expiresMode;
    if (expiresTo) cur.expiresTo = expiresTo;
    if (opts.source) cur.source = opts.source;
  }
}

function removeCondition(id) {
  id = normalizeConditionId(id);
  state.conditions = state.conditions.filter(c => c.id !== id);
}

function downgradeCondition(id) {
  id = normalizeConditionId(id);
  const idx = findConditionIndex(id);
  if (idx === -1) return;

  const c = state.conditions[idx];

  // Special: Wounded downgrades to Bruised.
  if (c.id === "Wounded") {
    removeCondition("Wounded");
    addCondition("Bruised", "Minor", { durationEvents: 2, source: "downgrade" });
    return;
  }

  if (c.severity === "Severe") {
    c.severity = "Minor";
    const dur = defaultConditionDurationEvents(c.id, "Minor");
    if (dur) c.expiresAt = (state.runEventIndex ?? 0) + dur;
    else delete c.expiresAt;
    delete c.expiresMode;
    delete c.expiresTo;
  } else {
    removeCondition(c.id);
  }
}

function applyConditionChange(ch) {
  if (!ch) return;
  const id = normalizeConditionId(ch.id);
  const mode = ch.mode;
  const sev = ch.severity ?? "Minor";
  const dur = ch.durationEvents;

  if (mode === "Add") addCondition(id, sev, { durationEvents: dur });
  else if (mode === "Remove") removeCondition(id);
  else if (mode === "Downgrade") downgradeCondition(id);
  else if (mode === "Upgrade") addCondition(id, "Severe", { durationEvents: dur });
}

function applyFlagChange(f) {
  if (!f) return;
  ensureStateMaps();
  if (f.mode === "Add") {
    state.flags[f.id] = f.durationEvents ?? 0; // 0 = permanent
  } else if (f.mode === "Remove") {
    delete state.flags[f.id];
  }
}

function applyStandingDelta(s) {
  if (!s) return;
  ensureStateMaps();
  const cur = state.standings[s.factionId] ?? "Neutral";
  const idx = tierIndex(cur);
  const next = clamp(idx + (s.steps ?? 0), 0, TIERS.length - 1);
  state.standings[s.factionId] = TIERS[next];
}

function applyBundle(bundle) {
  if (!bundle) return [];
  const post = [];

  for (const d of (bundle.resources ?? [])) applyResourceDelta(d);
  for (const c of (bundle.conditions ?? [])) applyConditionChange(c);
  for (const f of (bundle.flags ?? [])) applyFlagChange(f);
  for (const s of (bundle.standings ?? [])) applyStandingDelta(s);

  // "special" actions are game-state mutations that aren't simple res/cond/flag deltas.
  // Some specials defer UI (modals) until after the result screen closes.
  for (const sp of (bundle.special ?? [])) {
    const maybePost = applySpecial(sp);
    if (typeof maybePost === "function") post.push(maybePost);
  }

  return post;
}



function mergeBundles(a, b) {
  if (!a && !b) return null;
  if (!a) return deepCopy(b);
  if (!b) return deepCopy(a);

  const out = {
    text: [a.text, b.text].filter(Boolean).join("\n\n").trim(),
    resources: [...(a.resources ?? []), ...(b.resources ?? [])],
    conditions: [...(a.conditions ?? []), ...(b.conditions ?? [])],
    flags: [...(a.flags ?? []), ...(b.flags ?? [])],
    standings: [...(a.standings ?? []), ...(b.standings ?? [])],
    special: [...(a.special ?? []), ...(b.special ?? [])]
  };
  return out;
}

// ---------- Family / Heirs (prototype) ----------
function ensureFamilyState() {
  state.family ??= { spouse: null, prospect: null, heirs: [] };
      state.family.heirs ??= [];

    state.scrip ??= 0;
    state.cardLevels ??= {};
    state.lifetimeEvents ??= 0;
}

function openProspectModal(prospect, onDecision) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p class="muted">You are offered an introduction. This may set your life on a different course.</p>
    <div class="cardbtn committed" style="cursor:default">
      <div class="cardname">${prospect.given} ${prospect.family}</div>
      <div class="muted">${prospect.cultureName} • Age ${prospect.age} • ${prospect.station}</div>
      <div style="margin-top:6px">Temper: <b>${prospect.temper}</b></div>
      <div style="margin-top:6px">Dowry rumor: <b>+${prospect.dowry} Coin</b> if vows are made.</div>
    </div>
  `;

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.marginTop = "12px";

  const btnPursue = document.createElement("button");
  btnPursue.className = "btn";
  btnPursue.textContent = "Pursue the match";

  const btnDecline = document.createElement("button");
  btnDecline.className = "btn ghost";
  btnDecline.textContent = "Decline";

  btnPursue.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    onDecision(true);
  });
  btnDecline.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    onDecision(false);
  });

  row.appendChild(btnPursue);
  row.appendChild(btnDecline);
  wrap.appendChild(row);

  openModal("A Prospect", wrap, { locked: true });
}

function openChildModal(onConfirm) {
  const wrap = document.createElement("div");

  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = "A child is born. Choose their name and education focus.";
  wrap.appendChild(p);

  const names = generateHeirNameChoices(6);
  const nameGrid = document.createElement("div");
  nameGrid.className = "hand";
  wrap.appendChild(nameGrid);

  let chosenName = null;
  let chosenFocus = null;

  const focusWrap = document.createElement("div");
  focusWrap.style.marginTop = "10px";
  focusWrap.innerHTML = `<div class="muted">Education Focus (grants +1 when they take up the mantle):</div>`;
  const sel = document.createElement("select");
  sel.className = "inp";
  for (const s of STATS) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => { chosenFocus = sel.value; updateConfirm(); });
  chosenFocus = sel.value;
  focusWrap.appendChild(sel);
  wrap.appendChild(focusWrap);

  const btnConfirm = document.createElement("button");
  btnConfirm.className = "btn";
  btnConfirm.textContent = "Name the child";
  btnConfirm.style.marginTop = "12px";
  btnConfirm.disabled = true;

  function updateConfirm() {
    btnConfirm.disabled = !(chosenName && chosenFocus);
  }

  for (const nm of names) {
    const b = document.createElement("div");
    b.className = "cardbtn";
    b.tabIndex = 0;
    b.innerHTML = `<div class="cardname">${nm} ${state.familyName}</div><div class="muted">Choose name</div>`;
    const pickName = () => {
      chosenName = nm;
      [...nameGrid.children].forEach(x => x.classList.remove("committed"));
      b.classList.add("committed");
      updateConfirm();
    };
    b.addEventListener("click", pickName);
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") pickName(); });
    nameGrid.appendChild(b);
  }

  btnConfirm.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    onConfirm(chosenName, chosenFocus);
  });

  wrap.appendChild(btnConfirm);
  openModal("A Newborn", wrap, { locked: true });
}

function runPostActionsSequentially(actions, done) {
  // Post-actions frequently open follow-up modals (heirs, spouses, etc.).
  // If any post-action throws, we MUST continue so the run can't softlock
  // with an empty hand / disabled buttons.
  const list = (actions ?? []).filter(fn => typeof fn === "function");
  let i = 0;

  const step = () => {
    if (i >= list.length) return done?.();
    const fn = list[i++];
    try {
      fn(step);
    } catch (e) {
      console.error("Post-action error (skipping):", e);
      // Keep going; never block progression.
      step();
    }
  };

  try {
    step();
  } catch (e) {
    console.error("Post-action runner error:", e);
    done?.();
  }
}

function applySpecial(sp) {
  // Return a post-action function (takes next()) if it needs a modal / choice.
  if (!sp || !sp.type) return null;
  ensureFamilyState();

  switch (sp.type) {
    case "OfferProspect": {
      // Defer the choice until after the result modal closes.
      return (next) => {
        const prospect = generateProspect();
        state.family.prospect = prospect;

        openProspectModal(prospect, (accepted) => {
          if (!accepted) {
            // Player declined: cancel this courtship chain + short cooldown.
            state.family.prospect = null;
            applyFlagChange({ id: "ct_declined", mode: "Add", durationEvents: 6 });

            // Clear storyline activation/scheduling for the courtship chain, if it was set.
            applyFlagChange({ id: "sl_ct_active", mode: "Remove" });
            applyFlagChange({ id: "sl_ct_step2", mode: "Remove" });
            applyFlagChange({ id: "sl_ct_step3", mode: "Remove" });
            applyFlagChange({ id: "sl_ct_step4", mode: "Remove" });
            if (state.story?.due) delete state.story.due["ct"];
            log("You decline the match. The matter cools (for now).");
          } else {
            log(`You pursue a match with ${prospect.given} ${prospect.family}.`);
          }
          saveState();
          renderAll();
          next?.();
        });
      };
    }


    case "ClearProspect": {
      // Used by storyline outcomes to end a courtship attempt cleanly.
      state.family.prospect = null;
      return null;
    }

    case "FinalizeMarriage": {
      const p = state.family.prospect;
      if (p) {
        state.family.spouse = {
          given: p.given,
          family: p.family,
          cultureId: p.cultureId,
          cultureName: p.cultureName,
          age: p.age
        };
        state.family.prospect = null;
        applyFlagChange({ id: "has_spouse", mode: "Add", durationEvents: 0 });
        log(`Vows are made. You are wed to ${state.family.spouse.given} ${state.family.spouse.family}.`);
      }
      return null;
    }

    case "CreateHeir": {
      // Defer naming/focus to a modal.
      return (next) => {
        openChildModal((childName, focus) => {
          const child = { given: childName, family: state.familyName, age: 0, focus };
          state.family.heirs.push(child);
          applyFlagChange({ id: "has_heir", mode: "Add", durationEvents: 0 });
          log(`An heir is recorded: ${child.given} ${child.family} (Education: ${focus}).`);
          saveState();
          renderAll();
          next?.();
        });
      };
    }

    default:
      return null;
  }
}

function bundleNetResourceDeltas(bundle) {
  const net = Object.fromEntries(RES.map(r => [r, 0]));
  for (const d of (bundle?.resources ?? [])) {
    if (!d?.resource) continue;
    net[d.resource] = (net[d.resource] ?? 0) + (d.amount ?? 0);
  }
  return net;
}

// Decrement duration flags after each event
function tickFlags() {
  ensureStateMaps();
  for (const [k, v] of Object.entries(state.flags)) {
    if (v === 0) continue;        // permanent
    const next = v - 1;
    if (next <= 0) delete state.flags[k];
    else state.flags[k] = next;
  }
}


// ---------- Condition Engine (pressure + constraints + timers) ----------

function ensureCondMeta() {
  state.condMeta ??= {};
  if (!Number.isFinite(state.condMeta.starveMisses)) state.condMeta.starveMisses = 0;
  if (!Number.isFinite(state.condMeta.wantedHeat)) state.condMeta.wantedHeat = 0;
  if (!Number.isFinite(state.condMeta.woundedStrain)) state.condMeta.woundedStrain = 0;
}

function tickConditionsAfterEvent() {
  ensureConditionShapes();
  ensureCondMeta();

  const now = state.runEventIndex ?? 0;
  const pendingAdds = [];

  state.conditions = state.conditions.filter(c => {
    if (c.expiresAt != null && now >= c.expiresAt) {
      // Expiry behavior
      if (c.expiresMode === "DowngradeTo" && c.expiresTo) {
        pendingAdds.push({ id: c.expiresTo, severity: "Minor", durationEvents: defaultConditionDurationEvents(c.expiresTo, "Minor") });
      }
      return false; // remove expired
    }
    return true;
  });

  for (const a of pendingAdds) {
    addCondition(a.id, a.severity, { durationEvents: a.durationEvents, source: "expiry" });
  }
}

function commitCapForEvent(ev) {
  let cap = 2;

  if (hasCondition("Exhausted")) cap = Math.min(cap, 1);

  if (ev?.context === "Strife") {
    if (hasCondition("Bruised") || hasCondition("Wounded") || hasCondition("Starving")) cap = Math.min(cap, 1);
  }
  if (ev?.context === "Journey") {
    if (hasCondition("Starving")) cap = Math.min(cap, 1);
  }
  return cap;
}

function outcomeConditionRules(ev, o) {
  const reasons = [];
  const costs = [];

  // Helper to add a required spend to even attempt an outcome.
  function requireSpend(resource, amount, label) {
    const have = state.res?.[resource] ?? 0;
    if (have < amount) reasons.push(`${label} (need ${amount} ${resource})`);
    else costs.push({ resource, amount: -amount, label });
  }

  // Ill: peril costs supplies to steady yourself / medicate.
  const illSev = conditionSeverity("Ill");
  if (illSev && (o.tags ?? []).includes("Perilous")) {
    const need = (illSev === "Severe") ? 2 : 1;
    requireSpend("Supplies", need, "Too ill for peril");
  }

  // Exhausted: peril costs a ration/rest to push.
  if (hasCondition("Exhausted") && (o.tags ?? []).includes("Perilous")) {
    requireSpend("Supplies", 1, "Too exhausted to push perilously");
  }

  // Wounded: hard-block perilous fights.
  if (hasCondition("Wounded", "Severe") && ev?.context === "Strife" && (o.tags ?? []).includes("Perilous")) {
    reasons.push("Too wounded for a perilous fight");
  }

  // Wanted: being seen in Court requires cover.
  const wantedSev = conditionSeverity("Wanted");
  if (wantedSev && ev?.context === "Court") {
    const haveSecrets = (state.res?.Secrets ?? 0) >= 1;
    const haveInfluence = (state.res?.Influence ?? 0) >= 1;
    if (!haveSecrets && !haveInfluence) {
      reasons.push("Too visible while Wanted (need 1 Secrets or 1 Influence)");
    } else {
      // We'll spend Secrets first, otherwise Influence.
      costs.push({ resource: haveSecrets ? "Secrets" : "Influence", amount: -1, label: "Keep your name off tongues" });
    }
  }

  return { reasons, costs };
}

function applyPostEventConditionPressure(ev, outcome, success, isPartial, netDeltas) {
  ensureCondMeta();

  const post = { resources: [], conditions: [] };

  const wasVernalEvent = (state.seasonIndex === 0);
  const oTags = outcome?.tags ?? [];

  // Starving: if you didn't improve Supplies, your reputation frays and sickness follows.
  if (hasCondition("Starving")) {
    const netSup = netDeltas?.Supplies ?? 0;
    if (netSup > 0) {
      state.condMeta.starveMisses = 0;
    } else {
      state.condMeta.starveMisses += 1;
      post.resources.push({ resource: "Renown", amount: -1 });
      if (state.condMeta.starveMisses >= 2) {
        post.conditions.push({ id: "Ill", mode: "Add", severity: "Minor", durationEvents: 4 });
      }
    }

    // Clearing logic: once you've actually secured food again, the crisis passes but leaves you tired.
    if ((state.res?.Supplies ?? 0) >= 4) {
      post.conditions.push({ id: "Starving", mode: "Remove" });
    } else if ((state.res?.Supplies ?? 0) >= 2 && netSup > 0) {
      post.conditions.push({ id: "Starving", mode: "Remove" });
      post.conditions.push({ id: "Exhausted", mode: "Add", severity: "Minor", durationEvents: 2 });
    }
  }

  // Ill: vernal upkeep for medicine/comfort.
  if (wasVernalEvent && hasCondition("Ill")) {
    const sev = conditionSeverity("Ill");
    const coinNeed = (sev === "Severe") ? 2 : 1;

    if ((state.res?.Coin ?? 0) >= coinNeed) {
      post.resources.push({ resource: "Coin", amount: -coinNeed });
    } else if ((state.res?.Supplies ?? 0) >= 1) {
      post.resources.push({ resource: "Supplies", amount: -1 });
    } else {
      // Can't afford care: illness worsens.
      post.conditions.push({ id: "Ill", mode: "Upgrade" });
      post.conditions.push({ id: "Exhausted", mode: "Add", severity: "Minor", durationEvents: 2 });
    }
  }

  // Wounded: vernal bandage upkeep.
  if (wasVernalEvent && hasCondition("Wounded")) {
    if ((state.res?.Supplies ?? 0) >= 1) post.resources.push({ resource: "Supplies", amount: -1 });
    else if ((state.res?.Coin ?? 0) >= 2) post.resources.push({ resource: "Coin", amount: -2 });
    else post.conditions.push({ id: "Ill", mode: "Add", severity: "Minor", durationEvents: 4 });
  }

  // Exhausted crash: failing a perilous outcome while Exhausted can make you Ill.
  if (!success && !isPartial && hasCondition("Exhausted") && oTags.includes("Perilous")) {
    post.conditions.push({ id: "Ill", mode: "Add", severity: "Minor", durationEvents: 4 });
  }


  // Starving escalation: if Supplies stay at 0 for a full year, it worsens.
  if (hasCondition("Starving", "Minor") && (state.res?.Supplies ?? 0) === 0 && (state.condMeta.starveMisses ?? 0) >= 2) {
    post.conditions.push({ id: "Starving", mode: "Upgrade" });
  }

  // In Debt: seasonal interest + a clear condition once you're solvent again.
  if (hasCondition("In Debt")) {
    const netCoin = netDeltas?.Coin ?? 0;

    if (wasVernalEvent) {
      if ((state.res?.Coin ?? 0) >= 1) post.resources.push({ resource: "Coin", amount: -1 });
      else if ((state.res?.Influence ?? 0) >= 1) post.resources.push({ resource: "Influence", amount: -1 });
      else post.conditions.push({ id: "Disgraced", mode: "Add", severity: "Minor", durationEvents: 2 });
    }

    if ((state.res?.Coin ?? 0) >= 4 && netCoin > 0) {
      post.conditions.push({ id: "In Debt", mode: "Remove" });
    }
  }

  // Disgraced: a clean, public win in Court can wash it away.
  if (hasCondition("Disgraced")) {
    const netRen = netDeltas?.Renown ?? 0;
    if (ev?.context === "Court" && success && !oTags.includes("Scandalous")) post.conditions.push({ id: "Disgraced", mode: "Remove" });
    else if (netRen >= 2) post.conditions.push({ id: "Disgraced", mode: "Remove" });
  }

  // Paying cover (Secrets/Influence) in Court helps cool Wanted heat a bit.
  if (hasCondition("Wanted") && ev?.context === "Court") {
    if ((netDeltas?.Secrets ?? 0) < 0 || (netDeltas?.Influence ?? 0) < 0) {
      state.condMeta.wantedHeat = Math.max(0, (state.condMeta.wantedHeat ?? 0) - 1);
    }
  }

  // Wanted heat: public actions increase pressure; at higher heat, you draw more bounty events via weighting.
  if (hasCondition("Wanted")) {
    const publicish = (ev?.context === "Court") || (ev?.context === "Strife") || oTags.includes("Scandalous");
    if (publicish) state.condMeta.wantedHeat += 1;
    else state.condMeta.wantedHeat = Math.max(0, state.condMeta.wantedHeat - 1);
  }

  return post;
}
function conditionBias(ev) {
  let m = 1;

  // Avoid Court when Wanted / severely Disgraced.
  if (hasCondition("Wanted") && ev.context === "Court") m *= 0.35;
  if (hasCondition("Disgraced", "Severe") && ev.context === "Court") m *= 0.55;

  // Pull matching condition packs.
  if (hasCondition("Ill") && (ev.tags ?? []).includes("Illness")) m *= 3.2;
  if (hasCondition("Ill") && (ev.tags ?? []).includes("Recovery")) m *= 2.4;

  if (hasCondition("Exhausted") && (ev.tags ?? []).includes("Rest")) m *= 3.0;

  if (hasCondition("Wounded") && (ev.tags ?? []).includes("Injury")) m *= 3.0;
  if (hasCondition("Wounded") && (ev.tags ?? []).includes("Recovery")) m *= 2.0;

  if (hasCondition("Starving") && (ev.tags ?? []).includes("Hunger")) m *= 3.5;
  if (hasCondition("Starving") && (ev.tags ?? []).includes("Forage")) m *= 3.0;

  if (hasCondition("Wanted") && (ev.tags ?? []).includes("Bounty")) m *= 3.3;
  if (hasCondition("Wanted") && (ev.tags ?? []).includes("Hide")) m *= 2.6;

  return m;
}

// ---------- UI helpers ----------
function showMenu() {
  // Ensure scroll is never "stuck" off when switching screens
  document.body.style.overflow = "";

  if (elMenu) elMenu.classList.remove("hidden");
  if (topbarEl) topbarEl.classList.add("hidden");
  if (footerEl) footerEl.classList.add("hidden");

  elStart.classList.add("hidden");
  elGame.classList.add("hidden");
  if (elLegacy) elLegacy.classList.add("hidden");

  btnNewEvent.disabled = true;
}

function showStart() {
  // Ensure scroll is never "stuck" off when switching screens
  document.body.style.overflow = "";

  if (elMenu) elMenu.classList.add("hidden");
  if (topbarEl) topbarEl.classList.remove("hidden");
  if (footerEl) footerEl.classList.add("hidden");

  elStart.classList.remove("hidden");
  elGame.classList.add("hidden");
  if (elLegacy) elLegacy.classList.add("hidden");

  btnNewEvent.disabled = true;
  updateStartButtonState();
}

function showGame() {
  // Ensure scroll is never "stuck" off when switching screens
  document.body.style.overflow = "";

  if (elMenu) elMenu.classList.add("hidden");
  if (topbarEl) topbarEl.classList.remove("hidden");
  if (footerEl) footerEl.classList.remove("hidden");

  elStart.classList.add("hidden");
  if (elLegacy) elLegacy.classList.add("hidden");
  elGame.classList.remove("hidden");

  btnNewEvent.disabled = false;
}

function showLegacy() {
  // Ensure scroll is never "stuck" off when switching screens
  document.body.style.overflow = "";

  if (elMenu) elMenu.classList.add("hidden");
  if (topbarEl) topbarEl.classList.remove("hidden");
  if (footerEl) footerEl.classList.add("hidden");

  if (elLegacy) elLegacy.classList.remove("hidden");
  elStart.classList.add("hidden");
  elGame.classList.add("hidden");

  btnNewEvent.disabled = true;
  renderLegacyPage();
}

let modalLocked = false;
let modalOnClose = null;

function openModal(title, bodyEl, opts = {}) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.appendChild(bodyEl);

  // Ensure tall modals never 'lose' the header off-screen.
  modalBody.scrollTop = 0;
  // Prevent background scroll while a modal is open.
  document.body.style.overflow = "hidden";

  modalLocked = Boolean(opts.locked);
  btnModalClose.style.display = modalLocked ? "none" : "";

  // NEW: store the close callback for this modal only
  modalOnClose = typeof opts.onClose === "function" ? opts.onClose : null;

  modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  if (modalLocked) return;

  modalBackdrop.classList.add("hidden");
  modalLocked = false;
  document.body.style.overflow = "";
  btnModalClose.style.display = "";

  // NEW: fire once, then clear so it can't stack
  const cb = modalOnClose;
  modalOnClose = null;
  cb?.();
}

function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

// ---------- Rendering ----------
function renderCreationUI() {
  const bg = DATA.backgroundsById[bgSelect.value];
  if (!bg) return;

  creation.bgId = bg.id;

  // Remaining points
  allocRemainingEl.textContent = String(pointsRemaining());
  if (allocTotalEl) allocTotalEl.textContent = String(START_ALLOC_POINTS);
  if (statCapHintEl) statCapHintEl.textContent = String(STAT_CAP);

  // Allocation grid
  allocGrid.innerHTML = "";
  const startStats = normalizedBgStartStats(bg);
  const bgBonus = normalizedBgBonusStats(bg);
  const finalStats = computeFinalStats(bg);

  for (const s of STATS) {
    const row = document.createElement("div");
    row.className = "allocRow";

    const baseTotal = startStats[s] ?? BASELINE_STAT;
    const bgB = bgBonus[s] ?? 0;
    const alloc = creation.alloc[s] ?? 0;
    const final = finalStats[s] ?? 0;

    const allocLabel = (alloc >= 0) ? `+${alloc}` : `${alloc}`;
    const bgLabel = (bgB >= 0) ? `+${bgB}` : `${bgB}`;

    row.innerHTML = `
      <div class="allocStat">${s}</div>
      <div class="allocNums">
        <span class="badge">Base ${BASELINE_STAT}</span>
        <span class="badge">BG ${bgLabel}</span>
        <span class="badge">${allocLabel}</span>
        <span class="badge">= ${final}</span>
      </div>
      <div class="allocBtns">
        <button class="btn ghost" data-stat="${s}" data-delta="-1">−</button>
        <button class="btn ghost" data-stat="${s}" data-delta="1">+</button>
      </div>
    `;

    row.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const stat = btn.getAttribute("data-stat");
        const delta = Number(btn.getAttribute("data-delta"));

        if (delta > 0 && pointsRemaining() <= 0) return;

        const baseVal = startStats[stat] ?? BASELINE_STAT;
        const curAlloc = (creation.alloc[stat] ?? 0);
        const nextAlloc = curAlloc + delta;

        // Allow lowering stats down to 0 total (min 0).
        const minAlloc = -baseVal;
        if (delta < 0 && nextAlloc < minAlloc) return;

        // Prevent exceeding cap (based on base+alloc before trait mods).
        if (baseVal + nextAlloc > STAT_CAP) return;

        creation.alloc[stat] = nextAlloc;
        renderCreationUI();
      });
    });

    allocGrid.appendChild(row);
  }

  // Traits
  traitsListEl.innerHTML = "";
  for (const t of TRAITS) {
    const wrap = document.createElement("label");
    wrap.className = "traitRow";

    const checked = creation.traits.has(t.id);
    wrap.innerHTML = `
      <input type="checkbox" data-trait="${t.id}" ${checked ? "checked" : ""} />
      <div>
        <div><b>${t.name}</b></div>
        <div class="muted">${t.desc}</div>
      </div>
    `;

    const cb = wrap.querySelector("input");
    cb.addEventListener("change", () => {
      if (cb.checked) {
        if (creation.traits.size >= 2) {
          cb.checked = false;
          return;
        }
        creation.traits.add(t.id);
      } else {
        creation.traits.delete(t.id);
      }
      renderCreationUI();
    });

    traitsListEl.appendChild(wrap);
  }

  // --- Start screen helpers (robust even if ui.enhancements.v1.js is missing) ---
  const traitsPickedEl = document.getElementById("traitsPicked");
  if (traitsPickedEl) traitsPickedEl.textContent = String(creation.traits.size);

  // Lock trait selection at 2 while still allowing unchecking
  const lock = creation.traits.size >= 2;
  for (const box of traitsListEl.querySelectorAll("input[type='checkbox']")) {
    const shouldDisable = lock && !box.checked;
    box.disabled = shouldDisable;
    const label = box.closest("label");
    if (label) label.classList.toggle("disabled", shouldDisable);
  }

  // Keep the Begin button state in sync with the builder requirements
  updateStartButtonState();
}


function isMajorEventNow() {
  // Robust to legacy saves where age/seasonIndex may be strings or missing.
  const age = Number(state?.age);
  const seasonIndex = Number(state?.seasonIndex);
  if (!Number.isFinite(age) || !Number.isFinite(seasonIndex)) return false;
  return isMajorBeatAt(age, seasonIndex);
}

function renderStatus() {
  const season = SEASONS[state.seasonIndex];

  const who = `${state.charName ?? "Unknown"} ${state.familyName ?? ""}`.trim();
    ensureFamilyState();
  const spouseStr = state.family.spouse ? ` • Spouse: ${state.family.spouse.given}` : "";
  const kids = state.family.heirs?.length ?? 0;
  const kidsStr = kids ? ` • Children: ${kids}` : "";
  const ambStr = state?.ambitionName ? ` • Ambition: ${state.ambitionName}` : "";
  statusLine.textContent = `${who} • Age ${state.age} • ${season} • Heirs Ruled ${state.heirCount ?? 0}${spouseStr}${kidsStr}${ambStr}`;

  const hf = state.heirFocus ? ` (Heir Focus: ${state.heirFocus})` : "";
  statsLine.textContent =
    `Stats • Might ${state.stats.Might} • Wit ${state.stats.Wit} • Guile ${state.stats.Guile} • Gravitas ${state.stats.Gravitas} • Resolve ${state.stats.Resolve}${hf}`;

    resourceLine.textContent =
    `Coin ${state.res.Coin} • Supplies ${state.res.Supplies} • Renown ${state.res.Renown} • Influence ${state.res.Influence} • Secrets ${state.res.Secrets} • Scrip ${state.scrip ?? 0} • Heirlooms ${META.heirlooms} • Legacy ${META.legacy}`;

  if (standingLine) {
    const ids = (DATA.factions ?? []).map(f => f.id);
    const parts = ids.map(fid => {
      const tier = state.standings?.[fid] ?? "Neutral";
      return `${factionLabel(fid)} ${tier}`;
    });
    standingLine.textContent = `Standing: ${parts.join(" • ")}`;
  }

  const condStr = state.conditions.length
    ? state.conditions.map(c => `${c.id} (${c.severity})`).join(", ")
    : "None";
  conditionLine.textContent = `Conditions: ${condStr}`;

    // Show MAJOR only when the current event is actually a major event.
  majorPill.classList.toggle("show", (currentEvent?.kind === "major"));
}

function renderEvent() {
  eventName.textContent = currentEvent.name;
  ensureFamilyState();

  // Scene meta with icon
  const parts = [];
  parts.push(`<span class="eventScene">${ctxBadgeHtml(currentEvent.context)}<span class="eventSceneLabel">Scene:</span> <span class="eventSceneValue">${currentEvent.context}</span></span>`);
  if (currentEvent?.storyline?.id === "ct" && state.family.prospect) {
    parts.push(`<span class="eventProspect">Prospect: <span class="eventProspectValue">${state.family.prospect.given} (${state.family.prospect.cultureName})</span></span>`);
  }
  eventMeta.innerHTML = parts.join(`<span class="metaSep"> • </span>`);

  eventPrompt.textContent = currentEvent.prompt;
}



function renderOutcomes() {
  outcomesEl.innerHTML = "";

  // Focus panel (selected outcome details)
  const focus = document.createElement("div");
  focus.className = "outcomeFocus";

  if (selectedOutcomeIndex == null) {
    focus.innerHTML = `
      <div class="focusTitle">Choose an approach</div>
      <div class="muted">Select an outcome to see costs, results, and highlight playable cards.</div>
    `;
  } else {
    const o = currentEvent.outcomes[selectedOutcomeIndex];
    const cond = outcomeConditionRules(currentEvent, o);
    const attemptCosts = cond.costs ?? [];
    const attemptBundle = attemptCosts.length ? { resources: attemptCosts } : null;

    const metaBits = [];
    metaBits.push(`Stat: ${o.stat}`);
    metaBits.push(`Diff: ${o.diff}`);
    if ((o.allowed ?? []).length) metaBits.push(`Allows: ${(o.allowed ?? []).join(", ")}`);

    focus.innerHTML = `
      <div class="focusHeader">
        <div>
          <div class="focusTitle">${o.title}</div>
          <div class="muted">${o.desc ?? ""}</div>
          <div class="focusMeta muted">${metaBits.join(" • ")}</div>
        </div>
      </div>
    `;

    // Attempt cost
    if (attemptBundle) {
      const row = document.createElement("div");
      row.className = "resultRow";
      row.innerHTML = `<div class="resultLabel">Attempt cost</div>`;
      row.appendChild(renderResultBadges(attemptBundle));
      focus.appendChild(row);
    }

    // Results: Success / Failure
    const res = document.createElement("div");
    res.className = "focusResults";

    const successCol = document.createElement("div");
    successCol.className = "resultCol";
    successCol.innerHTML = `<div class="resultLabel good">On success</div>`;
    successCol.appendChild(renderResultBadges(o.success));

    const failCol = document.createElement("div");
    failCol.className = "resultCol";
    failCol.innerHTML = `<div class="resultLabel bad">On failure</div>`;
    failCol.appendChild(renderResultBadges(o.fail));

    res.appendChild(successCol);
    res.appendChild(failCol);

    focus.appendChild(res);
  }

  outcomesEl.appendChild(focus);

  // Compact list
  const list = document.createElement("div");
  list.className = "outcomeList";

  currentEvent.outcomes.forEach((o, idx) => {
    const baseReasons = unmetReasons(o.requirements);
    const cond = outcomeConditionRules(currentEvent, o);
    const reasons = [...baseReasons, ...(cond.reasons ?? [])];
    const disabled = reasons.length > 0;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "outcomeItem"
      + (selectedOutcomeIndex === idx ? " selected" : "")
      + (disabled ? " disabled" : "");

    // Small meta line (kept short)
    const meta = `Stat ${o.stat} • Diff ${o.diff}`;
    item.innerHTML = `
      <div class="outcomeItemTitle">${o.title}</div>
      <div class="outcomeItemMeta">${meta}</div>
      ${disabled ? `<div class="outcomeItemLock">Locked: ${reasons.join(" • ")}</div>` : ``}
    `;

    item.addEventListener("click", () => {
      if (disabled) return;
      selectedOutcomeIndex = idx;
      committed = [];
      showChanceDetails = false;
      renderAll();
    });

    list.appendChild(item);
  });

  outcomesEl.appendChild(list);

  // Resolve button
  btnResolve.disabled = selectedOutcomeIndex == null;
}

function renderHand() {
  const cids = committedCardIds();
  const cap = commitCapForEvent(currentEvent);

  slot1.textContent = cids[0] ? cardLabel(cids[0]) : "—";
  slot1.classList.toggle("muted", !cids[0]);

  // Slot2 is visually present, but conditions may cap commits to 1.
  const slot2Enabled = cap >= 2;
  slot2.textContent = (slot2Enabled && cids[1]) ? cardLabel(cids[1]) : "—";
  slot2.classList.toggle("muted", !slot2Enabled || !cids[1]);
  slot2.classList.toggle("disabled", !slot2Enabled);

  const hasOutcome = (selectedOutcomeIndex != null);
  if (!hasOutcome) {
    handHint.textContent = "Pick an outcome to commit cards. (Wild cards can be used anytime.)";
  } else {
    const commitReady = countCommitReadyCardsForOutcome(selectedOutcomeIndex);
    const wildCount = countWildCardsInHand();
    handHint.textContent = `Commit-ready: ${commitReady} • Wild usable: ${wildCount} • Tap highlighted cards to commit/uncommit (max ${cap}).`;
  }

  handEl.innerHTML = "";
  for (const entry of hand) {
    const cid = entry.cid;
    const c = DATA.cardsById[cid];
    if (!c) continue;

    const isWild = isWildCard(c);
    const playable = isWild ? true : (hasOutcome ? isCardUsable(cid, selectedOutcomeIndex) : false);
    const isCommitted = committed.includes(entry.iid);

    const lvlData = getCardLevelData(c);
    const arrowsText = isWild ? "✦" : (arrowsForBonus(lvlData.bonus) || "—");
    const arrowsClass = isWild ? "muted" : (arrowsForBonus(lvlData.bonus) ? (lvlData.bonus >= 0 ? "good" : "bad") : "muted");
    const rarityMark = cardRarityMark(c);
    const riderText = cardRiderText(c);
    const scenesText = cardScenesText(c);
    const line3 = isWild ? riderText : ([scenesText, riderText].filter(Boolean).join(" • ") + (lvlData.partialOnFail ? " • partial on failure" : ""))
    let usabilityHtml = "";
    if (hasOutcome) {
      const d = cardUsabilityDetails(cid, selectedOutcomeIndex);
      if (d.isWild) {
        usabilityHtml = `<div class="cardchips"><span class="chip chipWild">Wild</span><span class="chip chipGood">Scene ✓</span><span class="chip chipGood">Allowed ✓</span></div>`;
      } else {
        usabilityHtml = `<div class="cardchips">`
          + `<span class="chip ${d.sceneOk ? "chipGood" : "chipBad"}">Scene ${d.sceneOk ? "✓" : "✗"}</span>`
          + `<span class="chip ${d.allowedOk ? "chipGood" : "chipBad"}">Allowed ${d.allowedOk ? "✓" : "✗"}</span>`
          + `</div>`;
      }
    } else if (isWild) {
      usabilityHtml = `<div class="cardchips"><span class="chip chipWild">Wild</span></div>`;
    }
;

    const div = document.createElement("div");
    div.className = "cardbtn"
      + (isCommitted ? " committed" : "")
      + ((hasOutcome || isWild) ? (playable ? " playable" : " dim") : "");


    div.dataset.rarity = (c.rarity || "");
    div.dataset.discipline = (c.discipline || "");

    div.innerHTML = `
      <div class="cardHead">
        <div class="cardHeadTop">
          <div class="cardTitle">${c.name}</div>
          <div class="cardRarity">${rarityMark}</div>
        </div>

        <div class="cardHeadSub">
          <div class="discRow">
            ${discBadgeHtml(c.discipline)}
            <div class="discTextBlock">
              <div class="discName">${(c.discipline || "Wild").toUpperCase()}</div>
              <div class="discBonus ${arrowsClass}">${isWild ? "WILD" : ("Bonus " + arrowsText)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="cardRule"></div>

      <div class="cardBody">

      <div class="cardSection">
        <div class="sectionLabel">Playable scenes</div>
        ${playableScenesHtml(c)}
      </div>

      ${(!isWild && riderText) ? `
        <div class="cardSection">
          <div class="sectionLabel">Effect</div>
          <div class="effectText">${riderText}${(lvlData.partialOnFail ? ` <span class="muted">• partial on failure</span>` : "")}</div>
        </div>
      ` : (isWild && riderText) ? `
        <div class="cardSection">
          <div class="sectionLabel">Effect</div>
          <div class="effectText">${riderText}</div>
        </div>
      ` : ``}

      ${usabilityHtml}

      <div class="cardFlavor"><em>${cardFlavor(c)}</em></div>

      </div>
    `;


    div.addEventListener("click", () => {
      if (isWild) {
        playWildCard(entry.iid);
        return;
      }
      if (!hasOutcome) return;
      if (!playable) return;

      if (isCommitted) {
        committed = committed.filter(x => x !== entry.iid);
      } else {
        if (committed.length >= cap) return;
        committed.push(entry.iid);
      }
      renderAll();
    });

    handEl.appendChild(div);
  }
}


function renderChance() {
  btnResolve.disabled = (selectedOutcomeIndex == null);
  if (btnChanceMath) {
    const hasSel = (selectedOutcomeIndex != null);
    btnChanceMath.disabled = !hasSel;
    btnChanceMath.textContent = hasSel ? (showChanceDetails ? "Hide math" : "Math") : "Math";
  }

  if (selectedOutcomeIndex == null) {
    chanceLine.textContent = "Select an outcome.";
    chanceBreakdown.textContent = "";
    chanceLine.classList.remove("clickable");
    return;
  }

  chanceLine.classList.add("clickable");

  const o = currentEvent.outcomes[selectedOutcomeIndex];
  const parts = computeChanceParts(o, committedCardIds(), { ev: currentEvent, majorBeat: isMajorEventNow() });
  const chance = Math.round(parts.chance);

  const cls = (chance >= 60) ? "good" : (chance <= 35) ? "bad" : "";
  const band = chanceBand(chance);
  chanceLine.innerHTML = `Chance: <span class="${cls}">${band}</span> <span class="muted">(${chance}%)</span>`;

  if (!showChanceDetails) {
    chanceBreakdown.textContent = "";
    return;
  }

  const base = parts.prof.base;
  const statPart = Math.round(parts.statVal * parts.prof.statMult);
  const cards = Math.round(parts.cardBonus);
  const diffPart = Math.round(parts.diff * parts.prof.diffMult);
  const gapPart = Math.round(parts.gapPenalty);
  const condPart = Math.round(parts.condMod);

  const bits = [];
  bits.push(`Base ${base}`);
  bits.push(`+ Stat ${statPart}`);
  if (cards) bits.push(`+ Cards ${cards}`);
  bits.push(`− Diff ${diffPart}`);
  if (gapPart) bits.push(`− Gap ${gapPart}`);
  if (condPart) bits.push(`${condPart > 0 ? "+" : "−"} Conditions ${Math.abs(condPart)}`);

  chanceBreakdown.textContent = bits.join(" ");
}

function renderAll() {
  renderStatus();
  renderEvent();
  renderOutcomes();
  renderHand();
  renderChance();
}

// ---------- Event selection ----------
function eventWeight(ev) {
  const w = ev.weight ?? 1;
  return (Number.isFinite(w) && w > 0) ? w : 0;
}


// ---------- Event Director (weights + anti-repetition + simple state bias) ----------

// Optional precompute so weighting can look at what an event tends to do (gain/loss, perilous)
function annotateEventSignals() {
  const RES_KEYS = ["Coin","Supplies","Renown","Influence","Secrets"];
  for (const ev of (DATA.events ?? [])) {
    const sig = {
      maxGain: Object.fromEntries(RES_KEYS.map(k => [k, 0])),
      maxLoss: Object.fromEntries(RES_KEYS.map(k => [k, 0])),
      hasPerilous: false
    };

    for (const o of (ev.outcomes ?? [])) {
      if ((o.tags ?? []).includes("Perilous")) sig.hasPerilous = true;

      for (const bundle of [o.success, o.fail]) {
        for (const d of (bundle?.resources ?? [])) {
          const k = d.resource;
          const amt = d.amount ?? 0;
          if (!(k in sig.maxGain)) continue;
          if (amt > 0) sig.maxGain[k] = Math.max(sig.maxGain[k], amt);
          if (amt < 0) sig.maxLoss[k] = Math.min(sig.maxLoss[k], amt); // negative
        }
      }
    }
    ev._sig = sig;
  }
}

function recordEventHistory(ev) {
  if (!ev || !state) return;
  ensureStateMaps();
  const h = state.history;

  const id = ev.id;
  h.seen[id] = (h.seen[id] ?? 0) + 1;

  h.recentEvents.unshift(id);
  if (h.recentEvents.length > 30) h.recentEvents.length = 30;

  h.recentContexts.unshift(ev.context);
  if (h.recentContexts.length > 10) h.recentContexts.length = 10;
}

const BG_CONTEXT_BIAS = {
  // tuned for "feel" not realism; tweak freely
  "squire":           { Strife: 1.30, Journey: 1.10, Court: 1.00, Scheme: 0.85, Lore: 0.85 },
  "ledger_clerk":     { Court: 1.25, Lore: 1.20, Scheme: 1.00, Journey: 0.85, Strife: 0.75 },
  "street_urchin":    { Scheme: 1.35, Journey: 1.05, Strife: 1.00, Court: 0.80, Lore: 0.80 },
  "minor_noble":      { Court: 1.45, Scheme: 1.05, Lore: 0.90, Journey: 0.80, Strife: 0.75 },
  "pilgrim_wanderer": { Journey: 1.35, Lore: 1.25, Court: 0.90, Scheme: 0.80, Strife: 0.75 }
};

function contextBias(ev) {
  const bgId = state?.backgroundId ?? null;
  if (!bgId) return 1;
  const map = BG_CONTEXT_BIAS[bgId];
  if (!map) return 1;
  return map[ev.context] ?? 1;
}

function noveltyBias(ev) {
  const h = state?.history;
  if (!h) return 1;

  // Hard no-repeat window (measured in events, not years).
  // 2 events/year → 16 events ≈ 8 years.
  const noRepeatWindow = (ev?.kind === "major") ? 10 : 16;
  if (h.recentEvents?.slice(0, noRepeatWindow).includes(ev.id)) return 0;

  // Soft penalty for overall repeats
  const seen = h.seen?.[ev.id] ?? 0;
  // 0:1.00, 1:0.53, 2:0.36, 3:0.28...
  return 1 / (1 + (0.9 * seen));
}

function contextSmoothingBias(ev) {
  const h = state?.history;
  if (!h) return 1;

  const ctx = ev.context;
  const recent = h.recentContexts ?? [];
  let m = 1;

  // discourage streaks
  if (recent[0] === ctx) m *= 0.55;
  if (recent.slice(0, 3).includes(ctx)) m *= 0.80;

  return m;
}

function scarcityBias(ev) {
  const sig = ev?._sig;
  if (!sig) return 1;

  let m = 1;

  const coin = state.res?.Coin ?? 0;
  const sup  = state.res?.Supplies ?? 0;
  const ren  = state.res?.Renown ?? 0;
  const inf  = state.res?.Influence ?? 0;
  const sec  = state.res?.Secrets ?? 0;

  // If you're broke, pull events that can plausibly raise coin (or at least avoid burning more).
  if (coin <= 2) {
    if ((sig.maxGain.Coin ?? 0) > 0) m *= 1.45;
    if ((sig.maxLoss.Coin ?? 0) < 0) m *= 0.80;
  }

  // If you're low on supplies, pull events that can replenish, avoid ones that drain.
  if (sup <= 1) {
    if ((sig.maxGain.Supplies ?? 0) > 0) m *= 1.60;
    if ((sig.maxLoss.Supplies ?? 0) < 0) m *= 0.75;
  }

  // Reputation / influence / leverage: when you're at rock bottom, bias toward recovery.
  if (ren <= 1) {
    if ((sig.maxGain.Renown ?? 0) > 0) m *= 1.25;
    if ((sig.maxLoss.Renown ?? 0) < 0) m *= 0.85;
  }

  if (inf <= 1) {
    if ((sig.maxGain.Influence ?? 0) > 0) m *= 1.25;
    if ((sig.maxLoss.Influence ?? 0) < 0) m *= 0.85;
  }

  if (sec <= 0) {
    if ((sig.maxGain.Secrets ?? 0) > 0) m *= 1.30;
    if ((sig.maxLoss.Secrets ?? 0) < 0) m *= 0.85;
  }

  return m;
}

function riskBias(ev) {
  const sig = ev?._sig;
  if (!sig) return 1;

  const severe = state.conditions?.filter(c => c.severity === "Severe").length ?? 0;

  // When you're already in a bad spot, reduce the chance of repeatedly serving perilous events.
  if (severe >= 2 && sig.hasPerilous) return 0.65;

  return 1;
}

// Optional: allow you to define "pools" on events later, without breaking anything now.
// Example pools: ["bg:squire", "cond:Ill", "faction:Crown", "story:broken_oath"]
function poolBias(ev) {
  const pools = ev.pools;
  if (!Array.isArray(pools) || pools.length === 0) return 1;

  let m = 1;
  for (const p of pools) {
    if (p.startsWith("bg:")) {
      const bg = p.slice(3);
      m *= (state.backgroundId === bg) ? 2.0 : 0.35;
    } else if (p.startsWith("cond:")) {
      const cid = p.slice(5);
      m *= hasCondition(cid, "Any") ? 2.2 : 0.6;
    } else if (p.startsWith("flag:")) {
      const fid = p.slice(5);
      m *= hasFlag(fid) ? 2.0 : 0.7;

    } else if (p.startsWith("factionHeat:")) {
      const fid = p.slice("factionHeat:".length);
      const tier = state.standings?.[fid] ?? "Neutral";
      const score = tierIndex(tier) - tierIndex("Neutral"); // negative = heat
      if (score < 0) {
        // Wary/Hostile → retaliation content surges
        m *= (1 + 0.9 * Math.abs(score));
      } else {
        // Friendly factions rarely send the hounds
        m *= 0.45;
      }
    } else if (p.startsWith("faction:")) {
      const fid = p.slice("faction:".length);
      const tier = state.standings?.[fid] ?? "Neutral";
      const score = tierIndex(tier) - tierIndex("Neutral");
      if (score > 0) m *= (1 + 0.45 * score);      // Favored/Exalted → more faction content
      else if (score < 0) m *= Math.max(0.35, (1 + 0.25 * score)); // Wary/Hostile → less "invitation" content
    }
  }
  return m;
}


function ageBias(ev) {
  // Soft preference toward events that "fit" the current age inside their allowed range.
  // - If the event defines idealAge / ageSpan, we use that as the peak.
  // - Otherwise we treat the midpoint of [minAge,maxAge] as the peak.
  const age = state?.age ?? 0;
  const min = (ev.minAge ?? 16);
  const max = (ev.maxAge ?? 70);
  if (!Number.isFinite(age) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 1;

  const ideal = Number.isFinite(ev.idealAge) ? ev.idealAge : (min + max) / 2;
  const span = Number.isFinite(ev.ageSpan) ? Math.max(1, ev.ageSpan) : Math.max(1, (max - min) / 2);

  const closeness = clamp(1 - Math.abs(age - ideal) / span, 0, 1);
  // edges still possible; center is favored
  return 0.55 + 0.45 * closeness;
}

function eventDirectorWeight(ev) {
  // Base (data) weight:
  let w = eventWeight(ev);
  if (w <= 0) return 0;

  // Dynamic multipliers:
  w *= ageBias(ev);

  w *= contextBias(ev);
  w *= contextSmoothingBias(ev);
  w *= noveltyBias(ev);
  w *= scarcityBias(ev);
  w *= riskBias(ev);
  w *= poolBias(ev);

  // Condition attractors / avoiders:
  w *= conditionBias(ev);

  // Keep it sane
  return Math.max(0, w);
}
function weightedPick(items, weightFn) {
  if (!items || items.length === 0) return null;
  let total = 0;
  for (const it of items) total += (weightFn(it) ?? 0);
  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const it of items) {
    roll -= (weightFn(it) ?? 0);
    if (roll <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}


function pickLeastRecentlySeen(items) {
  const recent = state?.history?.recentEvents ?? [];
  let best = null;
  let bestScore = -1;

  for (const ev of (items ?? [])) {
    // recentEvents is kept to ~30 entries, so indexOf is cheap here.
    const idx = recent.indexOf(ev.id);
    const score = (idx === -1) ? 9999 : idx; // unseen beats anything; otherwise farther back = longer ago
    if (score > bestScore) { best = ev; bestScore = score; }
  }

  return best;
}

function pickEventFromPool(pool, avoidIds = [], weightFn = eventDirectorWeight, strictAvoid = false) {
  if (!pool || pool.length === 0) return null;
  const avoid = Array.isArray(avoidIds) ? avoidIds : [];

  const preferred = avoid.length ? pool.filter(e => !avoid.includes(e.id)) : pool;
  if (strictAvoid && avoid.length && preferred.length === 0) return null;

const picked = weightedPick(preferred, weightFn);
if (picked) return picked;

// If all weights were 0 (often because noveltyBias hard-blocked everything),
// pick the least-recently-seen option to maximize variety.
if (preferred.length) return pickLeastRecentlySeen(preferred) ?? pick(preferred);

// If strictAvoid is false, we can fall back to a repeat — again, prefer least-recent.
return pickLeastRecentlySeen(pool) ?? pick(pool);
}


function isStoryEvent(ev) {
  return Boolean(ev && ev.storyline && ev.storyline.id);
}
function storyFlag(id, key) {
  return `sl_${id}_${key}`;
}
function ensureStorylineMeta() {
  if (DATA.storylineMetaById) return;
  const map = {};
  for (const ev of (DATA.events ?? [])) {
    const sl = ev?.storyline;
    if (!sl?.id) continue;
    map[sl.id] ??= { id: sl.id, name: sl.name ?? sl.id, rarity: sl.rarity ?? "common" };
  }
  DATA.storylineMetaById = map;
}
function storylineMeta(id) {
  ensureStorylineMeta();
  return DATA.storylineMetaById?.[id] ?? { id, name: id, rarity: "common" };
}
function storylineRarityWeight(id) {
  const r = (storylineMeta(id).rarity ?? "common").toLowerCase();
  return STORYLINE_RARITY_WEIGHTS[r] ?? 1;
}
function activeStorylineIds() {
  ensureStorylineMeta();
  return Object.keys(DATA.storylineMetaById ?? {}).filter(id => hasFlag(storyFlag(id, "active")));
}
function isStoryActive(id) {
  return hasFlag(storyFlag(id, "active"));
}
function isStoryDone(id) {
  return hasFlag(storyFlag(id, "done"));
}
function storyDueIndex(id) {
  const due = state?.story?.due?.[id];
  return Number.isFinite(due) ? due : Infinity;
}
function isMajorBeatAt(age, seasonIndex) {
  // Major beats happen on Vernal (seasonIndex 0) at key ages.
  return seasonIndex === 0 && MAJOR_AGES.has(age);
}
function simulateAgeSeason(age, seasonIndex, steps) {
  let a = age;
  let s = seasonIndex;
  for (let i = 0; i < steps; i++) {
    s = 1 - s;
    if (s === 0) a += 1;
  }
  return { age: a, seasonIndex: s };
}
function pickGapAvoidingMajorFromNow() {
  // "Now" is the current selection state (after the last event has been resolved).
  const candidates = [];
  for (let g = STORYLINE_STEP_GAP_MIN; g <= STORYLINE_STEP_GAP_MAX; g++) {
    const sim = simulateAgeSeason(state.age, state.seasonIndex, g);
    if (!isMajorBeatAt(sim.age, sim.seasonIndex)) candidates.push(g);
  }
  if (!candidates.length) return STORYLINE_STEP_GAP_MAX;
  return candidates[rInt(0, candidates.length - 1)];
}
function updateStoryPacingAfterResolvedEvent(evJustResolved) {
  if (!state) return;
  state.story ??= { due: {} };
  state.story.due ??= {};

  if (!isStoryEvent(evJustResolved)) return;

  const sid = evJustResolved.storyline.id;

  // If the storyline ended (or never truly activated), clear its schedule.
  if (isStoryDone(sid) || !isStoryActive(sid)) {
    delete state.story.due[sid];
    return;
  }

  // Schedule the next step to *appear* after 4–8 intervening events,
  // and ensure the earliest-appearance slot is not a major beat.
  const gap = pickGapAvoidingMajorFromNow();
  state.story.due[sid] = (state.runEventIndex ?? 0) + gap;
}
function pickDueStoryEvent(avoidIds = []) {
  // Forced pick when a storyline step is due.
  const idx = state?.runEventIndex ?? 0;
  const dueMap = state?.story?.due ?? {};
  const dueIds = Object.entries(dueMap)
    .filter(([id, due]) => Number.isFinite(due) && due <= idx && isStoryActive(id) && !isStoryDone(id))
    .map(([id]) => id);

  if (!dueIds.length) return null;

  // If multiple are due, pick by earliest due date; tie-break by rarity.
  dueIds.sort((a, b) => {
    const da = storyDueIndex(a);
    const db = storyDueIndex(b);
    if (da !== db) return da - db;
    return storylineRarityWeight(b) - storylineRarityWeight(a);
  });

  const chosenId = dueIds[0];

  // Pick the next eligible event for that storyline.
  const pool = eligibleEvents({ kind: "general", story: "only", storyId: chosenId });
  const avoid = Array.isArray(avoidIds) ? avoidIds : [];
  const ev = pickEventFromPool(pool, avoid, eventDirectorWeight, false);
  if (!ev) {
    // If something went wrong (requirements mismatch), nudge due forward to avoid deadlock.
    state.story.due[chosenId] = (idx + 1);
    return null;
  }

  return ev;
}
function tryPickStoryHookEvent() {
  // Only hooks for inactive storylines. Also enforce max active storylines.
  const active = activeStorylineIds();
  if (active.length >= MAX_ACTIVE_STORYLINES) return null;

  const pool = eligibleEvents({ kind: "general", story: "only", storyRole: "hook", onlyInactiveStorylines: true });

  if (!pool.length) return null;

  return weightedPick(pool, (ev) => {
    const sid = ev.storyline.id;
    const rarityW = storylineRarityWeight(sid);

    let w = rarityW * eventDirectorWeight(ev);

    // Family safety-net: if you have no spouse/heir, heavily bias toward the courtship hook
    // so players see lineage play in a reasonable window.
    ensureFamilyState();
    if (sid === "ct" && !hasSpouse() && !hasHeir()) {
      if (state.age >= 18 && state.age <= 34) w *= 3.2;
      else if (state.age <= 40) w *= 2.0;
      else w *= 1.1;
      if (hasFlag("ct_declined")) w *= 0.35; // cooldown after declining a prospect
    }

    return w;
  });
}


function ensureStoryState() {
  if (!state) return;
  state.story ??= { due: {}, noStoryEvents: 0 };
  state.story.due ??= {};
  if (!Number.isFinite(state.story.noStoryEvents)) state.story.noStoryEvents = 0;
    ensureConditionShapes();
    ensureCondMeta();
}
function updateStoryCountersAfterResolvedEvent(evJustResolved) {
  if (!state) return;
  ensureStoryState();

  if (isStoryEvent(evJustResolved)) {
    state.story.noStoryEvents = 0;
  } else {
    state.story.noStoryEvents = (state.story.noStoryEvents ?? 0) + 1;
  }
}
function storylineHookChance() {
  ensureStoryState();
  const n = state.story.noStoryEvents ?? 0;
  let ch = STORYLINE_BASE_CHANCE;
  if (n >= STORYLINE_RAMP_START) {
    ch += (n - STORYLINE_RAMP_START + 1) * STORYLINE_RAMP_PER_EVENT;
  }
  return clamp(ch, 0, STORYLINE_MAX_CHANCE);
}
function shouldForceStoryHookAttempt() {
  ensureStoryState();
  return (state.story.noStoryEvents ?? 0) >= STORYLINE_PITY_EVENTS;
}


function eligibleEvents(opts = {}) {
  const kind = opts.kind ?? null;
  const majorStage = opts.majorStage ?? null; // only applies when kind:"major"


  // Story filtering:
  // - story: "any" | "exclude" | "only"
  // - storyId: restrict to a specific storyline id
  // - storyRole: restrict to storyline.role (e.g., "hook")
  // - onlyInactiveStorylines: when true, excludes storylines that are active or done
  const storyMode = (opts.story ?? "any");
  const storyId = opts.storyId ?? null;
  const storyRole = opts.storyRole ?? null;
  const onlyInactive = Boolean(opts.onlyInactiveStorylines);

  return DATA.events.filter(e => {
    if (state.age < (e.minAge ?? 16)) return false;
    if (state.age > (e.maxAge ?? 70)) return false;

    const k = e.kind ?? "general";
    if (kind && k !== kind) return false;

    // Major-stage filtering (Fate Knots + regular majors)
    if (k === "major" && majorStage) {
      if (Array.isArray(majorStage)) {
        if (!majorStage.includes(e.majorStage)) return false;
      } else {
        if ((e.majorStage ?? null) !== majorStage) return false;
      }
    }

    const isStory = isStoryEvent(e);
    if (storyMode === "exclude" && isStory) return false;
    if (storyMode === "only" && !isStory) return false;

    if (isStory) {
      const sid = e.storyline.id;

      if (storyId && sid !== storyId) return false;
      if (storyRole && (e.storyline.role ?? null) !== storyRole) return false;

      if (onlyInactive) {
        if (isStoryActive(sid) || isStoryDone(sid)) return false;
      }

      // Pacing rule: if a storyline is active, its steps can only appear when due.
      if (isStoryActive(sid)) {
        const due = storyDueIndex(sid);
        if ((state.runEventIndex ?? 0) < due) return false;
      }
    }

    // Optional future-proofing: support event-level requirements (not just outcome requirements)
    if (Array.isArray(e.requirements) && unmetReasons(e.requirements).length) return false;

    // Safety: never surface an event where every outcome is locked (by requirements or condition rules).
    const hasPlayableOutcome = (e.outcomes ?? []).some(o => {
      if (unmetReasons(o.requirements).length) return false;
      const cr = outcomeConditionRules(e, o);
      return (cr.reasons ?? []).length === 0;
    });
    if (!hasPlayableOutcome) return false;


    return true;
  });
}


function abandonCurrentEvent({ recordForNoRepeat = true } = {}) {
  if (!state) return;

  // Put any drawn cards back into circulation (discard pile) so rerolls/debug picks can't "delete" cards.
  for (const entry of (hand ?? [])) {
    if (entry?.cid) state.discardPile.push(entry.cid);
  }
  hand = [];
  committed = [];
  selectedOutcomeIndex = null;
  showChanceDetails = false;

  // Optionally mark the event as seen so immediate rerolls don't serve it again.
  if (recordForNoRepeat && currentEvent?.id) {
    ensureStateMaps();
    const h = state.history;
    const id = currentEvent.id;
    h.seen[id] = (h.seen[id] ?? 0) + 1;
    h.recentEvents.unshift(id);
    if (h.recentEvents.length > 30) h.recentEvents.length = 30;

    h.recentContexts.unshift(currentEvent.context);
    if (h.recentContexts.length > 10) h.recentContexts.length = 10;
  }
}




function makeFallbackEvent(reason = "") {
  const r = reason ? ` (${reason})` : "";
  return {
    id: "__fallback__",
    name: `A Quiet Season${r}`,
    prompt: "For once, nothing demands your blood or coin. You take stock, mend what you can, and prepare for whatever comes next.",
    context: "Hearth",
    kind: "general",
    minAge: 0,
    maxAge: 999,
    outcomes: [
      {
        title: "Keep the Household Steady",
        desc: "You focus on small preparations and steady work.",
        stat: "Resolve",
        diff: 1,
        allowed: ["Hearth","Quill","Seal","Veil","Steel"],
        tags: [],
        success: { text: "The season passes without incident. Small mercies matter.", effects: { resources: [{ resource: "Supplies", amount: 1 }] } },
        fail: { text: "You do what you can. Even so, trouble always finds its way back.", effects: {} }
      }
    ]
  };
}

function loadRandomEvent({ avoidIds = [] } = {}) {
  const majorBeat = isMajorEventNow();
  ensureStoryState();

  const avoid = Array.isArray(avoidIds) ? [...avoidIds] : [];
  if (currentEvent?.id && !avoid.includes(currentEvent.id)) avoid.push(currentEvent.id);

  // ---------- Major beats ----------
  if (majorBeat) {
    // Rule: never show storyline steps at the same time as a major beat.
    // Prefer Fate Knots when they are due; otherwise pull a regular major.
    let desiredStage = "major";

    if (state.age === 20 && !hasFlag('knot1_done')) desiredStage = "knot1";
    if (state.age === 35 && !hasFlag('knot2_done')) desiredStage = "knot2";
    if (state.age === 50 && !hasFlag('knot3_done')) desiredStage = "knot3";

    let pool = eligibleEvents({ kind: "major", story: "exclude", majorStage: desiredStage });

    // Fallbacks (in case of missing content or edge-case flags)
    if (!pool.length && desiredStage !== "major") pool = eligibleEvents({ kind: "major", story: "exclude" });
    if (!pool.length) pool = eligibleEvents({ kind: "general", story: "exclude" });
    if (!pool.length) pool = eligibleEvents({ story: "exclude" });
    if (!pool.length) pool = eligibleEvents({ story: "any" }); // absolute last resort

    const ev = pickEventFromPool(pool, avoid, eventDirectorWeight, false);
    if (!ev) {
      console.warn("No eligible events found for current age/filters. Using fallback event.");
      beginEvent(makeFallbackEvent("no eligible events"));
      return;
    }
    beginEvent(ev);
    return;
  }

  // ---------- Non-major beats ----------
  // 1) Forced storyline step if one is due (4–8 events after last step; never on majors).
  const due = pickDueStoryEvent(avoid);
  if (due) {
    beginEvent(due);
    return;
  }

  // 2) Storyline hook attempt (explicit draw chance + ramp + pity)
  const forceHook = shouldForceStoryHookAttempt();
  const hookChance = storylineHookChance();

  if (forceHook || Math.random() < hookChance) {
    const hook = tryPickStoryHookEvent();
    if (hook) {
      beginEvent(hook);
      return;
    }
  }

  // 3) Otherwise, pick a normal general event (excluding storyline events).
  let pool = eligibleEvents({ kind: "general", story: "exclude" });
  if (!pool.length) pool = eligibleEvents({ story: "exclude" });
    if (!pool.length) pool = eligibleEvents({ story: "any" }); // absolute last resort // last resort

  const ev = pickEventFromPool(pool, avoid, eventDirectorWeight, false);
  if (!ev) {
    console.warn("No eligible events found for current age/filters. Using fallback event.");
    beginEvent(makeFallbackEvent("no eligible events"));
    return;
  }

  beginEvent(ev);
}

function beginEvent(ev) {
  selectedOutcomeIndex = null;
  committed = [];
  showChanceDetails = false;
  currentEvent = ev;

  drawHand(handSizeForEvent(ev));
  renderAll();
  log(`\n=== ${ev.name} (${ev.context}) ===`);
}

// ---------- Debug: pick event ----------
function openEventPickerModal() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="muted">Pick any loaded event.</p>`;
  const list = document.createElement("div");
  list.className = "outcomes";

  for (const ev of DATA.events) {
    const b = document.createElement("button");
    b.className = "btn ghost";
    b.textContent = `${ev.id} — ${ev.name} (${ev.context})`;
    b.addEventListener("click", () => { abandonCurrentEvent({ recordForNoRepeat: false }); closeModal(); beginEvent(ev); });
    list.appendChild(b);
  }

  wrap.appendChild(list);
  openModal("Debug: Pick Event", wrap);
}

// ---------- Time ----------

// --- Annual Upkeep & Drift ---
// Lightweight: runs once per year, always explains itself via a modal.
// Goal: keeping *all* resources healthy is meaningfully hard, without keeping players broke.
function applyAnnualUpkeepAndDrift() {
  if (!state) return null;
  state.res ??= {};
  for (const r of RES) state.res[r] = Number.isFinite(state.res[r]) ? state.res[r] : 0;

  const before = { ...state.res };
  const lines = [];

  // Each line: a flavorful title + a short in-world explanation + the numeric changes.
  const addLine = (title, why, changes) => {
    if (!Array.isArray(changes) || changes.length === 0) return;
    const applied = [];
    for (const ch of changes) {
      const resource = ch?.resource;
      const amount = Number(ch?.amount ?? 0);
      if (!resource || !amount) continue;
      applyResourceDelta({ resource, amount });
      applied.push({ resource, amount });
    }
    if (applied.length) lines.push({ title, why: why || "", changes: applied });
  };

  const sup = state.res.Supplies ?? 0;
  const ren = state.res.Renown ?? 0;
  const inf = state.res.Influence ?? 0;
  const sec = state.res.Secrets ?? 0;
  const coin = state.res.Coin ?? 0;

  // 1) Living expenses: food + wear-and-tear (Supplies).
  if (sup > 0) {
    addLine(
      "The larder thins",
      "A year of meals, mended straps, and worn boots quietly eats at your stores.",
      [{ resource: "Supplies", amount: -1 }]
    );
  }

  // 2) Spoilage: stockpiles rot.
  if ((state.res.Supplies ?? 0) >= 10) {
    addLine(
      "Rot and rats",
      "A deep stockpile invites spoilage—grain goes stale, oil turns, and something always gets into the sacks.",
      [{ resource: "Supplies", amount: -1 }]
    );
  }

  // 3) Secrets decay if hoarded too high.
  if (sec >= 4) {
    addLine(
      "Whispers lose their edge",
      "Old leverage dulls when it isn’t used. The world moves on—and so do people’s fears.",
      [{ resource: "Secrets", amount: -1 }]
    );
  }

  // 4) Leverage + cover interplay (keeps Influence/Secrets meaningful).
  if (sec >= 3 && inf <= 0) {
    addLine(
      "Loose tongues in the dark",
      "Without friends to cover you, a rumor slips a little farther than you intended.",
      [{ resource: "Secrets", amount: -1 }]
    );
  }
  if (inf >= 7 && sec <= 0) {
    addLine(
      "Favors cool",
      "Connections need bargaining power. Without leverage, even warm doors slowly close.",
      [{ resource: "Influence", amount: -1 }]
    );
  }

  // 5) Status upkeep: high Renown/Influence costs Coin to maintain (but won't push you into poverty).
  if (ren >= 9 || inf >= 7) {
    if ((state.res.Coin ?? 0) >= 3) {
      addLine(
        "Dues and gifts",
        "A name and a network both require coin: small bribes, donations, and the right presents at the right time.",
        [{ resource: "Coin", amount: -1 }]
      );
    } else if (ren >= inf) {
      addLine(
        "Your name fades a shade",
        "Without coin to keep up appearances, the stories don’t carry as far this year.",
        [{ resource: "Renown", amount: -1 }]
      );
    } else {
      addLine(
        "Promises go unpaid",
        "Without coin to grease the hinges, a few favors drift out of reach.",
        [{ resource: "Influence", amount: -1 }]
      );
    }
  }

  // 6) Emergency provisions: if you're at 0 Supplies and have spare coin, auto-buy a little.
  // (This prevents the 'always broke' feel, but still costs something and is always shown.)
  if ((state.res.Supplies ?? 0) === 0 && (state.res.Coin ?? 0) >= 4) {
    addLine(
      "Bread and salt",
      "You refuse to let hunger set the terms. A single hard purchase keeps you standing.",
      [{ resource: "Coin", amount: -1 }, { resource: "Supplies", amount: +1 }]
    );
  }

  // 7) Small investments: big Coin cushions slowly turn into the weakest pillar.
  // This makes Coin useful, but also forces tradeoffs (Coin can't just be hoarded forever).
  if ((state.res.Coin ?? 0) >= 10) {
    const candidates = ["Supplies", "Influence", "Renown"];
    let lowest = candidates[0];
    let lowestVal = state.res[lowest] ?? 0;
    for (const c of candidates.slice(1)) {
      const v = state.res[c] ?? 0;
      if (v < lowestVal) { lowest = c; lowestVal = v; }
    }
    if (lowestVal <= 3) {
      addLine(
        "A prudent exchange",
        "Coin is safest when it becomes what you lack: a stocked shelf, a friendly door, or a steadier name.",
        [{ resource: "Coin", amount: -1 }, { resource: lowest, amount: +1 }]
      );
    }
  }

  // 8) Steady Year bonus: if you keep most resources in a healthy band, gain a redraw token (capped).
  let tokenAdded = 0;
  const afterRes = state.res;

  // Healthy band: 3–9 (keeps the early game from being too strict).
  const healthyCount = RES.filter(r => {
    const v = afterRes?.[r] ?? 0;
    return v >= 3 && v <= 9;
  }).length;

  if (healthyCount >= 4) {
    initPerLifeMeta();
    const base = trunkRank("t_better_odds") ?? 0;
    const cap = base + 3;
    const curTok = state.metaPerLife.redrawTokens ?? 0;
    if (curTok < cap) {
      state.metaPerLife.redrawTokens = curTok + 1;
      tokenAdded = 1;
    }
  }

  const after = { ...state.res };

  return { age: state.age, before, after, lines, tokenAdded };
}

function openYearEndModal(summary, onDone) {
  if (!summary) { onDone?.(); return; }

  const wrap = document.createElement("div");

  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "The year turns. Stores are counted, favors weighed, and old leverage tested against new realities.";
  wrap.appendChild(hint);

  const list = document.createElement("div");
  list.className = "outcomes";
  list.style.marginTop = "10px";

  const addRow = (title, why, changes) => {
    const row = document.createElement("div");
    row.className = "outcome";
    row.style.cursor = "default";

    const head = document.createElement("div");
    head.className = "outcome-title";
    head.textContent = title || "—";
    row.appendChild(head);

    if (why) {
      const whyEl = document.createElement("div");
      whyEl.className = "outcome-why";
      whyEl.textContent = why;
      row.appendChild(whyEl);
    }

    const pills = document.createElement("div");
    pills.className = "resultBadges";
    pills.style.marginTop = "8px";

    for (const ch of (changes ?? [])) {
      const amt = Number(ch?.amount ?? 0);
      if (!amt) continue;
      const pill = document.createElement("span");
      pill.className = "resultPill " + (amt > 0 ? "good" : "bad");
      pill.textContent = `${amt > 0 ? "↑" : "↓"} ${ch.resource} ${amt > 0 ? "+" : "-"}${Math.abs(amt)}`;
      pills.appendChild(pill);
    }

    if (pills.childNodes.length) row.appendChild(pills);
    list.appendChild(row);
  };

  if (Array.isArray(summary.lines) && summary.lines.length) {
    for (const ln of summary.lines) addRow(ln.title, ln.why, ln.changes);
  } else {
    addRow("A quiet turning", "Nothing shifts on its own this year.", []);
  }

  if (summary.tokenAdded) {
    addRow(
      "Steady Year",
      "By keeping your fortunes balanced, you buy yourself a breath of choice in the next trials.",
      [{ resource: "Redraw token", amount: +1 }]
    );
  }

  wrap.appendChild(list);

  const actions = document.createElement("div");
  actions.className = "modalActions";
  actions.style.marginTop = "12px";

  const btnOk = document.createElement("button");
  btnOk.className = "btn primary";
  btnOk.textContent = "Continue";
  btnOk.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    onDone?.();
  });

  actions.appendChild(btnOk);
  wrap.appendChild(actions);

  openModal(`Year End: Age ${summary.age}`, wrap, { locked: true });
}


function advanceTime() {
  // Count events completed (drives storyline pacing + condition timers).
  state.runEventIndex = (state.runEventIndex ?? 0) + 1;
  state.lifetimeEvents = (state.lifetimeEvents ?? 0) + 1;

  // Timers tick on completed events.
  tickConditionsAfterEvent();

  // Two events per year: Vernal / Autumnal
  state.seasonIndex = 1 - (state.seasonIndex ?? 0);

  if (state.seasonIndex === 0) {
    // A year passes.
    state.age += 1;

    ensureFamilyState();
    // Age spouse + children annually.
    if (state.family.spouse) state.family.spouse.age = (state.family.spouse.age ?? 16) + 1;
    for (const h of (state.family.heirs ?? [])) h.age = (h.age ?? 0) + 1;

    // Apply annual upkeep + drift, and stash a summary for an interstitial modal.
    try {
      const summary = applyAnnualUpkeepAndDrift();
      if (summary) {
        state.__yearEndSummary = summary;

        // Also log a compact trace.
        if (Array.isArray(summary.lines)) {
          for (const ln of summary.lines) {
            const parts = (ln.changes ?? []).map(c => `${c.resource} ${fmtDelta(c.amount)}`).join(", ");
            if (parts) log(`Year End — ${ln.title}: ${parts}`);
          }
        }
        if (summary.tokenAdded) log("Year End — Steady Year: Redraw token +1");
      }
    } catch (e) {
      console.warn("Year-end upkeep failed:", e);
    }

    log(`— A year passes. Age is now ${state.age}.`);
  }
}

function finishEvent(evJustResolved) {
  // Advance time (and tick condition/story timers).
  advanceTime();

  // Record history for anti-repeat + pacing
  if (evJustResolved) recordEventHistory(evJustResolved);
  updateStoryCountersAfterResolvedEvent(evJustResolved);
  updateStoryPacingAfterResolvedEvent(evJustResolved);

  // Release resolve lock (but keep buttons disabled until the next screen is ready).
  resolvingOutcome = false;
  btnNewEvent.disabled = true;
  btnDebugPickEvent.disabled = true;

  // Persist + reflect new time/resources before any interstitial.
  ensureOpportunityState();
  saveState();
  renderAll();

  // Start the next event (avoid immediate repeat of what you just played when possible).
  const avoid = evJustResolved?.id ? [evJustResolved.id] : [];

  const proceed = () => {
    btnNewEvent.disabled = false;
    btnDebugPickEvent.disabled = false;
    saveState();

    try {
      loadRandomEvent({ avoidIds: avoid });
    } catch (e) {
      console.error("Error while starting next event:", e);
      // Safety: never softlock; fall back to a quiet event.
      beginEvent(makeFallbackEvent("next-event error"));
    }
  };

  const maybeProceed = () => {
    if (shouldOfferOpportunity()) {
      openOpportunityModal({ onDone: proceed });
    } else {
      proceed();
    }
  };

  const runAmbitionInterstitial = () => {
    // If the player deferred an ambition, prompt once at age 20.
    const needsAmbitionAt20 =
      (state?.ambitionId == null) &&
      (state?.ambitionDeferred === true) &&
      (state?.age >= 20) &&
      !state?.ambitionPromptedAt20;

    if (needsAmbitionAt20) {
      // Mark as prompted immediately to prevent loops if something goes sideways.
      state.ambitionPromptedAt20 = true;
      saveState();

      const bgObj = DATA?.backgroundsById?.[state?.backgroundId] ?? null;
      openAmbitionPickerModal(bgObj, (amb) => {
        try {
          if (amb) {
            state.ambitionId = amb.id;
            state.ambitionName = amb.name ?? amb.id;
          } else {
            state.ambitionId = null;
            state.ambitionName = null;
          }
          // After the age-20 prompt, we stop deferring either way.
          state.ambitionDeferred = false;
          saveState();
          renderAll();
        } catch {}
        maybeProceed();
      }, { pickCount: 5, allowDefer: false, skipLabel: "Skip" });
    } else {
      maybeProceed();
    }
  };

  // If a year just passed, show upkeep/drift report first (so the player always knows why resources changed).
  const yearSummary = state?.__yearEndSummary;
  if (yearSummary) {
    state.__yearEndSummary = null; // clear first to avoid loops if something crashes
    saveState();

    openYearEndModal(yearSummary, () => {
      saveState();
      renderAll();
      runAmbitionInterstitial();
    });
    return;
  }

  runAmbitionInterstitial();
}

// ---------- Resolve ----------
function mitigateFailBundle(bundle, ev, outcome, committedCids, opts = {}) {
  if (!bundle) return bundle;
  if (!Array.isArray(bundle.conditions) || bundle.conditions.length === 0) return bundle;

  // Only mitigate when this bundle represents a "bad" result (fail/partial).
  // (We call this only from those branches.)
  const next = { ...bundle };
  next.conditions = (bundle.conditions ?? [])
    .map(c => mitigateFailCondition(c, ev, outcome, committedCids, opts))
    .filter(Boolean);

  return next;
}

function mitigateFailCondition(change, ev, outcome, committedCids, opts = {}) {
  if (!change) return change;

  const mode = change.mode ?? "Add";
  if (mode !== "Add") return change; // don't randomize removals/upgrades

  const baseSev = change.severity ?? "Minor";
  const resolve = state.stats.Resolve ?? 0;

  const hasHearth = (committedCids ?? []).some(cid => DATA.cardsById[cid]?.discipline === "Hearth");
  let guard = (resolve * 10) + (hasHearth ? 15 : 0);

  // Perilous consequences are harder to fully avoid.
  if ((outcome?.tags ?? []).includes("Perilous")) guard = Math.max(0, guard - 10);

  // Severe: often downgrades to Minor (instead of always sticking).
  if (baseSev === "Severe") {
    const downgradeChance = clamp(guard + 5, 0, 70);
    if (rInt(1, 100) <= downgradeChance) {
      if (change.id === "Wounded") return { ...change, id: "Bruised", severity: "Minor" };
      return { ...change, severity: "Minor" };
    }
    return change;
  }

  // Minor: small chance to shake it off entirely.
  const avoidChance = clamp(guard - 25, 0, 35);
  if (rInt(1, 100) <= avoidChance) return null;
  return change;
}

function resolveSelectedOutcome() {
  if (resolvingOutcome) return;
  if (selectedOutcomeIndex == null) return;

  resolvingOutcome = true;
  btnResolve.disabled = true;
  btnNewEvent.disabled = true;
  btnDebugPickEvent.disabled = true;

  const o = currentEvent.outcomes[selectedOutcomeIndex];

  const evJustResolved = currentEvent;

  // Compute success chance
  const chance = computeChance(o, committedCardIds());
  const roll = rInt(1, 100);
  const success = roll <= chance;

  // Tracking for result + any post-event modals
  let bundleForSummary = null;
  let isPartial = false;
  let postActions = [];

  // Attempt costs driven by conditions (paid whether you succeed or fail).
  const condRule = outcomeConditionRules(currentEvent, o);
  const attemptCosts = (condRule.costs ?? []).map(c => ({ resource: c.resource, amount: c.amount }));
  const attemptBundle = attemptCosts.length ? { resources: attemptCosts } : null;
  if (attemptBundle) postActions.push(...applyBundle(attemptBundle));

  // Exhaust the hand: all drawn cards go to discard after the event.
  for (const entry of hand) state.discardPile.push(entry.cid);
  hand = [];

  // Mortality tracking (before any new conditions this event adds)
  const severeBefore = state.conditions.filter(c => c.severity === "Severe").length;

  // Apply outcome effects

  if (success) {
    const cardBundle = bundleFromCommittedCards(committedCardIds(), "onSuccess");
    const merged = mergeBundles(o.success, cardBundle);
    postActions.push(...applyBundle(merged));
    bundleForSummary = merged;
    log(`SUCCESS (${roll} ≤ ${chance}) → ${o.title}`);
  } else {
    const partial = committedCardIds().some(cid => {
      const c = DATA.cardsById[cid];
      return c ? Boolean(getCardLevelData(c).partialOnFail) : false;
    });

    
    if (partial) {
      isPartial = true;
      log(`FAIL (${roll} > ${chance}) but PARTIAL triggers → ${o.title}`);

      const halfResources = [];
      for (const d of (o.success?.resources ?? [])) {
        const half = Math.trunc((d.amount ?? 0) / 2);
        halfResources.push({ resource: d.resource, amount: half });
      }

      const softenedConds = [];
      for (const c of (o.fail?.conditions ?? [])) {
        const sev = (c.severity === "Severe") ? "Minor" : (c.severity ?? "Minor");
        softenedConds.push({ ...c, severity: sev });
      }

      // Build a best-effort summary so the result modal matches what actually happened.
      const baseTxt = (o.fail?.text ?? '').trim() || (o.success?.text ?? '').trim();
      const partialTxt = baseTxt
        ? (baseTxt + "\n\nStill, you salvage what you can.")
        : "You don’t quite get what you wanted, but you salvage something.";

      let partialBundle = { text: partialTxt, resources: halfResources, conditions: softenedConds };
      partialBundle = mitigateFailBundle(partialBundle, currentEvent, o, committedCardIds(), { isPartial: true });

      const cardBundle = bundleFromCommittedCards(committedCardIds(), "onFailure");

      const merged = mergeBundles(partialBundle, cardBundle);
      postActions.push(...applyBundle(merged));
      bundleForSummary = merged;
    } else {
      const failBundle = mitigateFailBundle(o.fail, currentEvent, o, committedCardIds());
      const cardBundle = bundleFromCommittedCards(committedCardIds(), "onFailure");
      const merged = mergeBundles(failBundle, cardBundle);
      postActions.push(...applyBundle(merged));
      bundleForSummary = merged;
      log(`FAIL (${roll} > ${chance}) → ${o.title}`);
    }
  }

  // Post-event pressure from active conditions (upkeep, drains, heat, etc.)
  const combinedForNet = mergeBundles(attemptBundle, bundleForSummary);
  const netDeltas = bundleNetResourceDeltas(combinedForNet);
  const postPressure = applyPostEventConditionPressure(currentEvent, o, success, isPartial, netDeltas);
  if (postPressure) postActions.push(...applyBundle(postPressure));

  const bundleForResult = mergeBundles(mergeBundles(attemptBundle, bundleForSummary), postPressure);

  // Mortality triggers (design rules)
  const wasMajor = currentEvent.kind === "major";
  let secondBreathNote = "";

  // Earn Scrip even if a mortality check kills you.
  awardScripForResolvedEvent(evJustResolved, wasMajor);
  const perilous = (o.tags ?? []).includes("Perilous");

  const severeAfter = state.conditions.filter(c => c.severity === "Severe").length;
  const gainedSevere = severeAfter > severeBefore;
  const hadSevereAlready = severeBefore > 0;

  let mortalityTriggered = false;
  if (wasMajor) mortalityTriggered = true;
  if (perilous) mortalityTriggered = true;
  if (gainedSevere && hadSevereAlready) mortalityTriggered = true;

  if (mortalityTriggered) {
    const mChance = computeMortalityChance();
    const mRoll = rInt(1, 100);
    log(`Mortality Check: ${mChance}% (roll ${mRoll})`);
    if (mRoll <= mChance) {
      // Second Breath: intercept one fatal Mortality Check per life.
      if (bigUnlocked("b_second_breath")) {
        initPerLifeMeta();
        if (!state.metaPerLife.secondBreathUsed) {
          state.metaPerLife.secondBreathUsed = true;
          const pick = (currentEvent?.context === "Strife") ? "Wounded" : "Ill";
          addCondition(pick, "Severe", { source: "Second Breath" });
          state.res.Coin = clamp((state.res.Coin ?? 0) - 3, 0, 99);
          state.res.Supplies = clamp((state.res.Supplies ?? 0) - 3, 0, 99);
          secondBreathNote = `Second Breath kept you standing. (-3 Coin, -3 Supplies, +Severe ${pick})`;
          log(`✦ Second Breath: you live. (Roll ${mRoll} <= ${mChance})`);
        } else {
          log(`💀 Death claims you at age ${state.age}.`);

          // Release the lock (succession is modal-driven).
          resolvingOutcome = false;
          btnNewEvent.disabled = false;
          btnDebugPickEvent.disabled = false;

          handleDeath();
          return;
        }
      } else {
        log(`💀 Death claims you at age ${state.age}.`);

        // Release the lock (succession is modal-driven).
        resolvingOutcome = false;
        btnNewEvent.disabled = false;
        btnDebugPickEvent.disabled = false;

        handleDeath();
        return;
      }
    }
  }

  // Cleanup (exactly once per resolved event)
  tickFlags();
  committed = [];
  selectedOutcomeIndex = null;

  // Result modal -> (Major? draft modal) -> finishEvent()
  const outcomeLabel = success ? "Success" : (isPartial ? "Partial" : "Failure");
  const subtitle = success
    ? `Success! You pursued: ${o.title}`
    : (isPartial ? `Partial success. You pursued: ${o.title}` : `Failure. You pursued: ${o.title}`);

  const narrativeBase = (bundleForResult?.text ?? "").trim() || defaultResultNarrative(currentEvent, o, success, isPartial);
  const narrative = secondBreathNote ? `${narrativeBase}\n\n${secondBreathNote}` : narrativeBase;
  const { resources, conditions } = summarizeBundleForPlayer(bundleForResult);

  saveState();
  renderAll();

  openResultModal({
    title: `Outcome: ${outcomeLabel}`,
    subtitle,
    narrative,
    resources,
    conditions,
    locked: false,
    onClose: () => {
      const safeFinish = () => {
        // Absolutely never allow an exception here to strand the player
        // on the same event with an empty hand.
        try {
          finishEvent(evJustResolved);
        } catch (e) {
          console.error("finishEvent crashed (emergency unlock):", e);
          // Emergency unlock + fallback event.
          resolvingOutcome = false;
          btnNewEvent.disabled = false;
          btnDebugPickEvent.disabled = false;
          try {
            beginEvent(makeFallbackEvent("finishEvent error"));
          } catch {}
        }
      };

      const afterPost = () => {
        if (wasMajor) {
          // Draft modal is optional but must never block progression.
          let advanced = false;
          const done = () => {
            if (advanced) return;
            advanced = true;
            safeFinish();
          };
          try {
            openDraftModal(() => done());
          } catch (e) {
            console.error("Draft modal error (skipping draft):", e);
            done();
          }

          // Ultra-defensive: if for any reason the draft modal didn't actually open,
          // don't strand the run.
          if (modalBackdrop.classList.contains("hidden")) {
            console.warn("Draft modal did not open; advancing to avoid softlock.");
            done();
          }
        } else {
          safeFinish();
        }
      };

      try {
        runPostActionsSequentially(postActions, afterPost);
      } catch (e) {
        console.error("Post-action chain failed (skipping):", e);
        afterPost();
      }
    }
  });
}

// ---------- Succession ----------

function openLifeEndModal(primary) {
  const legacyGained = computeLegacyGain();
  META.legacy += legacyGained;
  saveMeta();
  const conds = (state.conditions ?? []).map(c => `${c.id} (${c.severity})`).join(", ") || "None";
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p><b>You died at age ${state.age}</b>.</p>
    <p class="muted">Final conditions: ${conds}</p>
    <div class="spacer"></div>
    <div class="resultGrid">
      <div class="resultBlock"><div class="muted small">Scrip gained</div><div class="big">+${SCRIP_ON_DEATH_BONUS}</div></div>
      <div class="resultBlock"><div class="muted small">Heirlooms gained</div><div class="big">+0</div></div>
      <div class="resultBlock"><div class="muted small">Legacy gained</div><div class="big">+${legacyGained}</div></div>
    </div>
    <div class="spacer"></div>
  `;

  const actions = document.createElement("div");
  actions.className = "modalActions";

  const up = document.createElement("button");
  up.className = "btn ghost";
  up.textContent = "Upgrade Cards";
  up.addEventListener("click", () => {
    closeModal();
    openOpportunityModal({ onDone: () => openLifeEndModal(primary) });
  });

  const cont = document.createElement("button");
  cont.className = "btn primary";
  cont.textContent = `Continue as ${primary.given}`;
  cont.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    proceedSuccession(primary);
  });

  actions.appendChild(up);
  actions.appendChild(cont);
  wrap.appendChild(actions);

  openModal("Run End", wrap, { locked: true });
}

function openBloodlineEndModal() {
  const conds = (state.conditions ?? []).map(c => `${c.id} (${c.severity})`).join(", ") || "None";
  const legacyGained = computeLegacyGain();
  META.legacy += legacyGained;
  saveMeta();

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p><b>You died at age ${state.age}</b>. With no named heir, your line ends.</p>
    <p class="muted">Final conditions: ${conds}</p>
    <div class="spacer"></div>
    <div class="resultGrid">
      <div class="resultBlock"><div class="muted small">Legacy gained</div><div class="big">+${legacyGained}</div></div>
      <div class="resultBlock"><div class="muted small">Scrip kept</div><div class="big">0</div><div class="muted small">Scrip upgrades are lost when a bloodline ends.</div></div>
      <div class="resultBlock"><div class="muted small">Heirlooms gained</div><div class="big">+0</div><div class="muted small">Scaffolding (future unlock currency).</div></div>
    </div>
    <div class="spacer"></div>
  `;

  const actions = document.createElement("div");
  actions.className = "modalActions";

  const newRun = document.createElement("button");
  newRun.className = "btn primary";
  newRun.textContent = "New Run";
  newRun.addEventListener("click", () => {
    localStorage.removeItem(SAVE_KEY);
    state = null;
    logEl.textContent = "";
    modalLocked = false;
    closeModal();
    showMenu();
  });

  actions.appendChild(newRun);
  wrap.appendChild(actions);

  openModal("Bloodline End", wrap, { locked: true });
}

function handleDeath() {
  ensureFamilyState();

  // Award death bonus now (shown in the Run End screen).
  awardScrip(SCRIP_ON_DEATH_BONUS, "Death");

  state.heirCount = (state.heirCount ?? 0) + 1;

  // Inheritance attrition (resources carry, but not cleanly)
  state.res.Coin = Math.floor((state.res.Coin ?? 0) * 0.7);
  state.res.Supplies = Math.floor((state.res.Supplies ?? 0) * 0.7);
  state.res.Renown = Math.floor((state.res.Renown ?? 0) * 0.8);
  state.res.Influence = Math.floor((state.res.Influence ?? 0) * 0.8);
  state.res.Secrets = Math.floor((state.res.Secrets ?? 0) * 0.8);

  // Clear Minors; Severe becomes Minor
  state.conditions = state.conditions
    .filter(c => c.severity === "Severe")
    .map(c => ({ id: c.id, severity: "Minor" }));

  // If no eligible heir exists, the bloodline ends.
  const heirs = (state.family.heirs ?? []).slice().sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
  const primary = heirs[0] ?? null;

  if (!primary) {
    openBloodlineEndModal();
    return;
  }

  // Show end-of-life summary and let the player upgrade before continuing.
  openLifeEndModal(primary);
  return;
}


function proceedSuccession(primary) {
  // Regency shortcut (prototype): if the heir is too young, time passes off-screen.
  if ((primary.age ?? 0) < STARTING_AGE) {
    const years = STARTING_AGE - (primary.age ?? 0);
    state.res.Coin = Math.floor((state.res.Coin ?? 0) * 0.85);
    state.res.Influence = Math.floor((state.res.Influence ?? 0) * 0.85);
    addCondition("Disgraced", "Minor", { durationEvents: 8 });
    log(`A regency holds for ${years} year(s). The estate frays under distant hands.`);
  }

  // New ruler takes over.
  state.charName = primary.given;
  state.heirFocus = primary.focus ?? null;

  if (state.heirFocus) {
    state.stats[state.heirFocus] = clamp((state.stats[state.heirFocus] ?? 0) + 1, 0, STAT_CAP);
  }

  // Reset per-life pacing.
  state.age = STARTING_AGE;
  state.seasonIndex = 0;
  state.runEventIndex = 0;
  state.story = { due: {}, noStoryEvents: 0 };

  // Clear per-life flags (including storylines) so each ruler feels fresh.
  for (const k of Object.keys(state.flags ?? {})) {
    if (k.startsWith("sl_")) delete state.flags[k];
  }
  // Clear spouse + children (new ruler must build their own line).
  // Also clear per-life family flags.
  delete state.flags.has_spouse;
  delete state.flags.has_heir;
  delete state.flags.ct_declined;
  delete state.flags.ct_awkward;
  delete state.flags.ct_secret_bond;
  delete state.flags.ct_terms_soured;

  // Clear spouse + children (new ruler must build their own line).
  state.family = { spouse: null, prospect: null, heirs: [] };

  log(`Heir takes over: ${state.charName} ${state.familyName}. Focus bonus: ${state.heirFocus ? `+1 ${state.heirFocus}` : "None"}. Heirs ruled so far: ${state.heirCount}.`);
  saveState();
  renderAll();
  loadRandomEvent();
}


// ---------- UI wiring ----------
btnReset.addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  state = null;
  logEl.textContent = "";
  showMenu();
});

if (btnMenuStart) {
  btnMenuStart.addEventListener("click", () => {
    showStart();
  });
}
if (btnStartBack) {
  btnStartBack.addEventListener("click", () => {
    showMenu();
    updateLegacyUIBadges();
  });
}


function openAmbitionPickerModal(bg, onPick, opts = {}) {
  const ambitions = Array.isArray(DATA.ambitions) ? DATA.ambitions : [];
  const pool = ambitions.filter(a => a && a.id);

  if (!pool.length) {
    onPick?.(null, { deferred: false });
    return;
  }

  // Only offer a small random subset (keeps the choice snappy).
  const pickCount = Math.max(1, Math.min(16, opts.pickCount ?? 5));
  const offered = shuffle([...pool]).slice(0, Math.min(pickCount, pool.length));

  let chosen = null;

  const wrap = document.createElement("div");

  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "Choose a personal ambition for this life. You'll earn Scrip on completion and Legacy at life end if completed.";
  wrap.appendChild(hint);

  const grid = document.createElement("div");
  grid.className = "hand";
  wrap.appendChild(grid);

  const renderTile = (amb) => {
    const tile = document.createElement("div");
    tile.className = "cardbtn";
    tile.tabIndex = 0;

    const objLines = (amb?.objectives ?? [])
      .map(o => o?.text)
      .filter(Boolean)
      .slice(0, 4)
      .map(t => `<div class="muted small">• ${escapeHtml(t)}</div>`)
      .join("");

    tile.innerHTML = `
      <div class="row space" style="align-items:flex-start;">
        <div>
          <div class="cardname">${escapeHtml(amb?.name ?? amb?.id ?? "Ambition")}</div>
          <div class="muted small" style="margin-top:4px;">${escapeHtml(amb?.desc ?? "")}</div>
        </div>
      </div>
      <div style="margin-top:8px;">${objLines}</div>
    `;

    const pickThis = () => {
      chosen = amb;
      [...grid.children].forEach(x => x.classList.remove("committed"));
      tile.classList.add("committed");
      btnConfirm.disabled = false;
    };

    tile.addEventListener("click", pickThis);
    tile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") pickThis(); });

    return tile;
  };

  for (const amb of offered) {
    if (!amb?.id) continue;
    grid.appendChild(renderTile(amb));
  }

  const actions = document.createElement("div");
  actions.className = "modalActions";
  actions.style.marginTop = "12px";

  const allowDefer = (opts.allowDefer ?? true) === true;
  const btnSkip = document.createElement("button");
  btnSkip.className = "btn ghost";
  btnSkip.textContent = allowDefer ? (opts.deferLabel ?? "Defer until age 20") : (opts.skipLabel ?? "Skip");
  btnSkip.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    onPick?.(null, { deferred: allowDefer });
  });

  const btnConfirm = document.createElement("button");
  btnConfirm.className = "btn";
  btnConfirm.textContent = "Commit Ambition";
  btnConfirm.disabled = true;
  btnConfirm.addEventListener("click", () => {
    modalLocked = false;
    closeModal();
    onPick?.(chosen, { deferred: false });
  });

  actions.appendChild(btnSkip);
  actions.appendChild(btnConfirm);
  wrap.appendChild(actions);

  openModal("Choose an Ambition", wrap, { locked: true });
}


function startRunWithOptionalAmbition(bg, given, family) {
  openAmbitionPickerModal(bg, (amb, meta) => {
    const deferred = !!meta?.deferred;

    // Stash in creation for visibility / future-proofing
    creation.ambitionId = amb?.id ?? null;
    creation.ambitionDeferred = deferred;

    // Start the run
    startRunFromBuilder(bg, given, family);

    // Attach to state after run start
    try {
      if (amb) {
        state.ambitionId = amb.id;
        state.ambitionName = amb.name ?? amb.id;
        state.ambitionDeferred = false;
      } else {
        state.ambitionId = null;
        state.ambitionName = null;
        state.ambitionDeferred = deferred; // defer only when user chose "Defer until age 20"
      }
      state.ambitionPromptedAt20 = false;
      saveState();
      renderAll();
    } catch {}
  }, { pickCount: 5, allowDefer: true, deferLabel: "Defer until age 20" });
}



btnStart.addEventListener("click", () => {
  const bg = DATA.backgroundsById[bgSelect.value];
  if (!bg) return;

  const given = (charNameInput.value ?? "").trim();
  const family = (familyNameInput.value ?? "").trim();

  if (!given || !family) {
    alert("Please enter a given name and a family name.");
    return;
  }

  if (pointsRemaining() !== 0) {
    alert(`Please spend all ${START_ALLOC_POINTS} allocation points.`);
    return;
  }

  if (creation.traits.size !== 2) {
    alert("Please choose exactly 2 starting traits.");
    return;
  }

  startRunWithOptionalAmbition(bg, given, family);
});

if (btnLegacy) {
  btnLegacy.addEventListener("click", () => {
    // Ensure meta exists even before the first run.
    loadMeta();
    showLegacy();
  });
}
if (btnLegacyBack) {
  btnLegacyBack.addEventListener("click", () => {
    showMenu();
    updateLegacyUIBadges();
  });
}

// Update the Begin button label/state as the user types.
charNameInput.addEventListener("input", () => updateStartButtonState());
familyNameInput.addEventListener("input", () => updateStartButtonState());


btnResolve.addEventListener("click", () => resolveSelectedOutcome());
if (btnChanceMath) {
  btnChanceMath.addEventListener("click", () => {
    if (selectedOutcomeIndex == null) return;
    showChanceDetails = !showChanceDetails;
    renderChance();
  });
}
chanceLine.addEventListener("click", () => {
  if (selectedOutcomeIndex == null) return;
  showChanceDetails = !showChanceDetails;
  renderChance();
});
btnNewEvent.addEventListener("click", () => {
  if (resolvingOutcome) return;
  const avoid = currentEvent?.id ? [currentEvent.id] : [];
  abandonCurrentEvent({ recordForNoRepeat: true });
  loadRandomEvent({ avoidIds: avoid });
});
btnDebugPickEvent.addEventListener("click", () => openEventPickerModal());
btnModalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });

// ---------- Start / Load ----------

function pointsSpent() {
  return STATS.reduce((sum, s) => sum + (creation.alloc[s] ?? 0), 0);
}

function pointsRemaining() {
  return START_ALLOC_POINTS - pointsSpent();
}

// Keep the start button state (and its label) aligned with current builder choices.
// This reduces confusing "why can't I start?" situations, especially on mobile.
function updateStartButtonState() {
  if (!btnStart) return;

  const given = (charNameInput?.value ?? "").trim();
  const family = (familyNameInput?.value ?? "").trim();
  const rem = pointsRemaining();
  const picked = creation?.traits?.size ?? 0;

  const ready = Boolean(given && family && rem === 0 && picked === 2);
  btnStart.disabled = !ready;

  // Friendly, single-step prompts.
  if (!given || !family) {
    btnStart.textContent = "Enter your name";
  } else if (rem !== 0) {
    btnStart.textContent = `Spend ${rem} point${rem === 1 ? "" : "s"}`;
  } else if (picked !== 2) {
    btnStart.textContent = "Pick 2 traits";
  } else {
    btnStart.textContent = "Begin Run";
  }
}

function traitById(id) {
  return TRAITS.find(t => t.id === id) || null;
}

function defaultStats() {
  return Object.fromEntries(STATS.map(s => [s, 0]));
}

// Normalize background starting stats for the current stat system.
// - If STAT_CAP is 10 but background stats were authored on the old 0–5 scale, scale them up by STAT_SCALE.
// - Then lower the baseline by 1 (min 0), per tuning request (reduces easy maxing).
function normalizedBgBonusStats(bg) {
  // Background stats can be authored two ways:
  // 1) "Totals" with BASELINE_STAT baked in (common in our JSON: lots of 1s)
  // 2) Pure "bonuses" where 0 = no bonus
  //
  // We normalize to *bonus over BASELINE_STAT* on the current stat system.
  const raw = deepCopy(bg?.startStats ?? bg?.stats) ?? defaultStats();
  const out = defaultStats();

  const vals = STATS.map(s => raw[s]).filter(v => typeof v === "number");
  const max = vals.length ? Math.max(...vals) : 0;

  // If background stats look like they've already been scaled to 0–10, unscale them back to 0–5-ish
  // before converting to bonuses. This prevents accidental double-scaling.
  const assumeScaled = (STAT_CAP === 10 && max > 5);

  // Heuristic: if any stat is explicitly 0, treat the set as bonuses (0 = no bonus).
  const authoredAsBonuses = vals.some(v => v === 0);

  for (const s of STATS) {
    let v = raw[s];
    if (typeof v !== "number") v = authoredAsBonuses ? 0 : BASELINE_STAT;
    if (assumeScaled) v = Math.round(v / STAT_SCALE);

    const bonus = authoredAsBonuses ? v : (v - BASELINE_STAT);
    out[s] = bonus;
  }
  return out;
}

// Normalize background starting stats for the current stat system.
// We want *display/base* to start at BASELINE_STAT and backgrounds to add bonuses on top.
function normalizedBgStartStats(bg) {
  const bonus = normalizedBgBonusStats(bg);
  const base = defaultStats();
  for (const s of STATS) base[s] = clamp(BASELINE_STAT + (bonus[s] ?? 0), 0, STAT_CAP);
  return base;
}

function defaultRes() {
  return Object.fromEntries(RES.map(r => [r, 0]));
}

function computeFinalStats(bg) {
  const base = normalizedBgStartStats(bg);

  for (const s of STATS) {
    base[s] = clamp((base[s] ?? 0) + (creation.alloc[s] ?? 0), 0, STAT_CAP);
  }

  for (const tid of creation.traits) {
    const t = traitById(tid);
    if (t?.statMods) {
      for (const [k, v] of Object.entries(t.statMods)) {
        base[k] = clamp((base[k] ?? 0) + v, 0, STAT_CAP);
      }
    }
  }
  return base;
}

function computeFinalResources(bg) {
  const r = deepCopy(bg.startRes ?? bg.res) ?? defaultRes();

  for (const tid of creation.traits) {
    const t = traitById(tid);
    if (t?.resMods) {
      for (const [k, v] of Object.entries(t.resMods)) {
        r[k] = clamp((r[k] ?? 0) + v, 0, 99);
      }
    }
  }
  return r;
}

function computeStartingConditions() {
  const out = [];
  for (const tid of creation.traits) {
    const t = traitById(tid);
    for (const c of (t?.addConditions ?? [])) out.push({ id: c.id, severity: c.severity ?? "Minor" });
  }
  return out;
}


function resetCreation() {
  creation.bgId = bgSelect.value || null;
  creation.ambitionId = null;
  creation.alloc = Object.fromEntries(STATS.map(s => [s, 0]));
  creation.traits = new Set();
}

function populateBackgroundSelect() {
  bgSelect.innerHTML = "";

  for (const bg of DATA.backgrounds) {
    const opt = document.createElement("option");
    opt.value = bg.id;
    opt.textContent = bg.name;
    bgSelect.appendChild(opt);
  }

  if (DATA.backgrounds.length) {
    bgSelect.value = DATA.backgrounds[0].id;
  }

  resetCreation();
  renderCreationUI();
}

// ONLY wire this once:
bgSelect.addEventListener("change", () => {
  resetCreation();
  renderCreationUI();
});



function showLoadingUI(isLoading) {
  btnStart.disabled = isLoading;
  btnNewEvent.disabled = isLoading;
  btnResolve.disabled = true;
  if (isLoading) {
    logEl.textContent = "Loading data...\n";
  }
  // When loading finishes, align the Start button with the builder state.
  if (!isLoading) updateStartButtonState();
}

function normalizeStartStandings(val) {
  if (!val) return {};
  // Legacy array format: [{ factionId, tier }]
  if (Array.isArray(val)) {
    const out = {};
    for (const s of val) {
      if (!s || !s.factionId) continue;
      out[String(s.factionId)] = String(s.tier ?? "Neutral");
    }
    return out;
  }
  // Map format: { crown: "Favored" }
  if (typeof val === "object") return deepCopy(val);
  return {};
}

function startRunFromBuilder(bg, givenName, familyName) {
  const deckIds = expandDeck(bg.deck);
  const validDeck = deckIds.filter(cid => DATA.cardsById[cid]);
  const starterDeck = normalizeStarterDeck(validDeck);

  if (!validDeck.length) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p>This background's starting deck contains no valid cards.</p>
      <p class="muted">Fix backgrounds.json (deck entries must reference existing card ids). Then press Reset and start again.</p>
    `;
    openModal("Deck Error", wrap, { locked: false });
    resolvingOutcome = false;
    btnNewEvent.disabled = false;
    btnDebugPickEvent.disabled = false;
    return;
  }


  const finalStats = computeFinalStats(bg);
  const finalRes = computeFinalResources(bg);
  const startConds = computeStartingConditions();

  state = {
    charName: givenName,
    familyName,
    backgroundId: bg.id,
    backgroundName: bg.name,
    age: STARTING_AGE,
    seasonIndex: 0,
    heirCount: 0,
    runEventIndex: 0,
    opportunity: { nextAt: rInt(OPPORTUNITY_GAP_MIN, OPPORTUNITY_GAP_MAX) },
    story: { due: {}, noStoryEvents: 0 },
    condMeta: { starveMisses: 0, wantedHeat: 0, woundedStrain: 0 },

    // Meta-in-bloodline
    scrip: 0,
    cardLevels: {},
    lifetimeEvents: 0,

    // IMPORTANT: no heir focus until you actually have an heir
    heirFocus: null,

    family: { spouse: null, prospect: null, heirs: [] },

    traits: Array.from(creation.traits),

    stats: finalStats,
    _statScale: STAT_CAP,
    res: finalRes,
    conditions: startConds,

    flags: {},
    standings: normalizeStartStandings(bg.startStandings ?? bg.startStanding),
    masterDeck: [...starterDeck],
    drawPile: shuffle([...starterDeck]),
    discardPile: []
  };

  // Enable background-specific event packs (bev_*) that use HasFlag bg_<backgroundId>.
  // These flags are meant to be permanent markers, so we store them with duration 0 (presence-only).
  try { state.flags[`bg_${bg.id}`] = 0; } catch {}

  saveState();
  logEl.textContent = "";
  log(`Run begins as ${state.charName} ${state.familyName} (${bg.name}). Traits: ${state.traits.join(", ")}`);
  showGame();
  loadRandomEvent();
}


async function boot() {
  showLoadingUI(true);
  setBootMsg("Loading data...");

  try {
    await loadAllData();
  } catch (e) {
    console.error(e);
    showLoadingUI(false);
    setBootMsg(`ERROR: ${e.message} (check /data paths + JSON validity)`);
    showStart();
    return;
  }

  showLoadingUI(false);
  setBootMsg("");

  loadMeta();
  updateLegacyUIBadges();
  populateBackgroundSelect();

  if (loadState()) {
    state.flags ??= {};
    state.standings ??= {};
    state.runEventIndex ??= 0;
    state.opportunity ??= { nextAt: (state.runEventIndex ?? 0) + rInt(OPPORTUNITY_GAP_MIN, OPPORTUNITY_GAP_MAX) };
    if (!Number.isFinite(state.opportunity.nextAt)) state.opportunity.nextAt = (state.runEventIndex ?? 0) + rInt(OPPORTUNITY_GAP_MIN, OPPORTUNITY_GAP_MAX);
    state.story ??= { due: {}, noStoryEvents: 0 };
    state.story.due ??= {};
    if (!Number.isFinite(state.story.noStoryEvents)) state.story.noStoryEvents = 0;
    // Newer saves track spouse/children.
    state.family ??= { spouse: null, prospect: null, heirs: [] };
    state.family.heirs ??= [];

    // --- Save migration safety ---
    // Ensure deck piles exist and cannot become empty due to older saves.
    state.drawPile = Array.isArray(state.drawPile) ? state.drawPile : [];
    state.discardPile = Array.isArray(state.discardPile) ? state.discardPile : [];

    if (!Array.isArray(state.masterDeck) || state.masterDeck.length === 0) {
      const combined = [...state.drawPile, ...state.discardPile];
      state.masterDeck = combined.length ? [...combined] : [];
    }
    if (state.drawPile.length === 0 && Array.isArray(state.masterDeck) && state.masterDeck.length) {
      state.drawPile = shuffle([...state.masterDeck]);
      state.discardPile = [];
    }

    ensureStatScale();

    showGame();
    logEl.textContent = "";
    log("Loaded saved run state.");
    loadRandomEvent();
  } else {
    showMenu();
  }
}


// ---------- Legacy effects wiring (runtime) ----------
// __legacy_patch_block__
function initPerLifeMeta() {
  state.metaPerLife ??= {};
  const lifeStamp = state.heirCount ?? 0;
  if (state.metaPerLife.lifeStamp !== lifeStamp) {
    state.metaPerLife = {
      lifeStamp,
      redrawTokens: trunkRank("t_better_odds") ?? 0,
      mulliganUsed: false,
      secondBreathUsed: false,
      lastEventIndex: -1
    };
  }
}

function legacyContextChanceBonus(ev) {
  if (!ev) return 0;
  const ctx = ev.context;
  let bonus = 0;
  if (ctx === "Strife") bonus += (branchRank("steel", "s_hard_blows") * 2);
  if (ctx === "Lore")   bonus += (branchRank("quill", "q_keen_eye") * 2);
  if (ctx === "Scheme") bonus += (branchRank("veil", "v_slip_net") * 2);
  if (ctx === "Court")  bonus += (branchRank("seal", "se_presence") * 2);
  // Hearth has no flat context bonus; it shows up in mortality/conditions.
  return bonus;
}

function applyLegacyStartDeckBonus() {
  if (!state) return;
  if (bigUnlocked("b_heirloom_vault")) {
    const id = "candle_witness";
    if (DATA?.cardsById?.[id] && Array.isArray(state.masterDeck) && !state.masterDeck.includes(id)) {
      state.masterDeck.push(id);
      // ensure it's drawable
      state.drawPile.push(id);
    }
  }
}

function tryRemoveOneMinorCondition(reason = "") {
  const idx = (state.conditions ?? []).findIndex(c => c.severity === "Minor");
  if (idx >= 0) {
    const removed = state.conditions[idx];
    state.conditions.splice(idx, 1);
    if (reason) log(`(Legacy) ${reason}: removed ${removed.id} (Minor).`);
    return true;
  }
  return false;
}

// Wrap computeFinalResources to include trunk start resource bonuses.
const __origComputeFinalResources = computeFinalResources;
computeFinalResources = function(bg) {
  const r = __origComputeFinalResources(bg);
  r.Supplies  = clamp((r.Supplies  ?? 0) + trunkRank("t_packed_satchel"), 0, 99);
  r.Coin      = clamp((r.Coin      ?? 0) + trunkRank("t_stashed_coin"), 0, 99);
  r.Renown    = clamp((r.Renown    ?? 0) + trunkRank("t_known_name"), 0, 99);
  r.Influence = clamp((r.Influence ?? 0) + trunkRank("t_old_introductions"), 0, 99);
  r.Secrets   = clamp((r.Secrets   ?? 0) + trunkRank("t_quiet_compromises"), 0, 99);
  return r;
};

// Wrap computeMortalityChance for trunk + hearth endurance.
const __origComputeMortalityChance = computeMortalityChance;
computeMortalityChance = function() {
  let base = __origComputeMortalityChance();
  base -= trunkRank("t_hardened_years");
  base -= branchRank("hearth", "h_endure");
  return Math.max(0, base);
};

// Wrap computeChanceParts for steady hands + context bonus, and tweak gap penalty for Quill.
const __origComputeChanceParts = computeChanceParts;
computeChanceParts = function(outcome, committedCids, opts = {}) {
  const parts = __origComputeChanceParts(outcome, committedCids, opts);
  const ev = opts.ev ?? currentEvent;
  const steady = trunkRank("t_steady_hands");
  const ctxBonus = legacyContextChanceBonus(ev);

  // Quill: reduce stat gap pressure
  const quillGapReduce = branchRank("quill", "q_methodical");
  const newGapPenalty = Math.max(0, (parts.gapPenalty ?? 0) - quillGapReduce);
  const deltaGap = (parts.gapPenalty ?? 0) - newGapPenalty;

  parts.gapPenalty = newGapPenalty;
  parts.raw = (parts.raw ?? 0) + steady + ctxBonus + deltaGap;
  parts.chance = clamp(parts.raw, 5, 95);
  return parts;
};

// Wrap handSizeForEvent for branch capstones.
const __origHandSizeForEvent = handSizeForEvent;
handSizeForEvent = function(ev) {
  let n = __origHandSizeForEvent(ev);

  if (ev?.context === "Strife" && bigUnlocked("s_battle_tempo")) n += 1;
  if (ev?.context === "Lore"   && bigUnlocked("q_archivists_certainty")) n += 1;
  if (ev?.context === "Court"  && bigUnlocked("se_network")) n += 1;

  return Math.max(1, n);
};

// Wrap addCondition for branch mitigation
const __origAddCondition = addCondition;
addCondition = function(id, severity, opts = {}) {
  const norm = normalizeConditionId(id);

  // Veil capstone: first Wanted(Severe) per life becomes Minor.
  if (norm === "Wanted" && severity === "Severe" && bigUnlocked("v_shadow_alias")) {
    initPerLifeMeta();
    if (!state.metaPerLife.wantedAliasUsed) {
      state.metaPerLife.wantedAliasUsed = true;
      severity = "Minor";
      opts = { ...opts, source: (opts.source ? opts.source + " +Alias" : "Alias") };
    }
  }

  // Steel mitigation: Wounded(Severe) becomes Minor at higher ranks.
  if (norm === "Wounded" && severity === "Severe") {
    const scar = branchRank("steel", "s_scar_tissue");
    if (scar >= 3) severity = "Minor";
  }

  // Seal mitigation: Disgraced gets downgraded at higher ranks.
  if (norm === "Disgraced" && severity === "Severe") {
    const mask = branchRank("seal", "se_immunity");
    if (mask >= 4) severity = "Minor";
  }

  // Hearth: shorten Minor condition durations.
  const clean = branchRank("hearth", "h_clean_living");
  if (clean > 0 && severity === "Minor") {
    const d = (opts.durationEvents ?? defaultConditionDurationEvents(norm, severity));
    const cut = Math.min(d, Math.floor(clean / 2)); // small, meaningful
    if (Number.isFinite(d) && d > 0 && cut > 0) opts = { ...opts, durationEvents: Math.max(1, d - cut) };
  }

  return __origAddCondition(id, severity, opts);
};

// Wrap beginEvent to init per-life and per-event, and apply Hearth capstone on major events.
const __origBeginEvent = beginEvent;
beginEvent = function(ev) {
  initPerLifeMeta();
  applyLegacyStartDeckBonus();

  // Per-event reset
  state.metaPerLife.lastEventIndex = state.runEventIndex ?? 0;
  state.metaPerLife.redrawUsedThisEvent = false;

  // Hearth capstone: before a Major Event begins, remove one Minor condition.
  if (bigUnlocked("h_unbroken_year")) {
    const isMajor = (ev?.kind === "major");
    if (isMajor) tryRemoveOneMinorCondition("Unbroken Year");
  }

  __origBeginEvent(ev);

  // Hearth node: after major events, chance-based cleanup happens later (post-resolution).
  // UI badges
  updateLegacyUIBadges();
};

// Add simple post-success bonuses for some branches.
function legacySuccessBonusBundle(ev, success) {
  if (!success || !ev) return null;
  const ctx = ev.context;
  if (ctx === "Strife") {
    const r = branchRank("steel", "s_battle_reputation");
    const amt = (r >= 5) ? 2 : (r >= 2 ? 1 : 0);
    if (amt) return { resources: [{ resource: "Renown", amount: amt }], text: "" };
  }
  if (ctx === "Scheme") {
    const r = branchRank("veil", "v_dirty_leverage");
    const amt = (r >= 5) ? 2 : (r >= 2 ? 1 : 0);
    if (amt) return { resources: [{ resource: "Secrets", amount: amt }], text: "" };
  }
  if (ctx === "Court") {
    const r = branchRank("seal", "se_favors");
    const amt = (r >= 5) ? 2 : (r >= 2 ? 1 : 0);
    if (amt) return { resources: [{ resource: "Influence", amount: amt }], text: "" };
  }
  if (ctx === "Lore") {
    const r = branchRank("quill", "q_notes");
    const amt = (r >= 5) ? 2 : (r >= 2 ? 1 : 0);
    if (amt) return { resources: [{ resource: "Secrets", amount: amt }], text: "" };
  }
  return null;
}

// Patch resolveSelectedOutcome mortality to respect Second Breath and apply branch bonuses.
const __origResolveSelectedOutcome = resolveSelectedOutcome;
resolveSelectedOutcome = function() {
  // Hook by calling original, but we need to intercept internally; so we re-implement the death-intercept via a soft flag.
  // Easiest: set a temporary flag and let a tiny patch inside mortality log below handle it.
  return __origResolveSelectedOutcome();
};

// Because resolveSelectedOutcome is large, we intercept death at the logging site by wrapping handleDeath.
const __origHandleDeath = handleDeath;
handleDeath = function() {
  // If Second Breath is unlocked and we haven't used it this life, consume it instead of dying.
  if (bigUnlocked("b_second_breath")) {
    initPerLifeMeta();
    if (!state.metaPerLife.secondBreathUsed && state.__pendingDeathIntercept) {
      state.metaPerLife.secondBreathUsed = true;
      state.__pendingDeathIntercept = false;

      // Consequence: add a Severe condition + drain resources.
      const pick = (currentEvent?.context === "Strife") ? "Wounded" : "Ill";
      addCondition(pick, "Severe", { source: "Second Breath" });
      state.res.Coin = clamp((state.res.Coin ?? 0) - 3, 0, 99);
      state.res.Supplies = clamp((state.res.Supplies ?? 0) - 3, 0, 99);

      log("✦ Second Breath: death passes you by—this time.");
      saveState();
      renderAll();
      return; // do not die
    }
  }
  return __origHandleDeath();
};

// Small patch: mark a pending intercept right before handleDeath() is called.
const __origLog = log;
log = function(msg) {
  // Detect the specific death log line used by the engine and mark the intercept.
  if (typeof msg === "string" && msg.includes("💀 Death claims you")) {
    state.__pendingDeathIntercept = true;
  }
  return __origLog(msg);
};

// Wire hand tools
function redrawHandCore({ consumeToken = true, markMulligan = false } = {}) {
  if (!state || !currentEvent) return;
  initPerLifeMeta();

  if (consumeToken) {
    if ((state.metaPerLife.redrawTokens ?? 0) <= 0) return;
    state.metaPerLife.redrawTokens -= 1;
  }
  if (markMulligan) state.metaPerLife.mulliganUsed = true;

  // Discard current hand back into circulation
  for (const entry of (hand ?? [])) {
    if (entry?.cid) state.discardPile.push(entry.cid);
  }
  hand = [];
  committed = [];
  selectedOutcomeIndex = null;
  showChanceDetails = false;

  drawHand(handSizeForEvent(currentEvent));
  saveState();
  renderAll();
}

if (btnRedrawHand) {
  btnRedrawHand.addEventListener("click", () => {
    initPerLifeMeta();
    if ((state.metaPerLife.redrawTokens ?? 0) <= 0) return;
    if (state.metaPerLife.redrawUsedThisEvent) return;
    state.metaPerLife.redrawUsedThisEvent = true;
    redrawHandCore({ consumeToken: true });
  });
}
if (btnMulliganHand) {
  btnMulliganHand.addEventListener("click", () => {
    initPerLifeMeta();
    if (!bigUnlocked("b_fate_stitching")) return;
    if (state.metaPerLife.mulliganUsed) return;
    state.metaPerLife.mulliganUsed = true;
    redrawHandCore({ consumeToken: false, markMulligan: true });
  });
}

// Wrap renderHand to update title and tool visibility.
const __origRenderHand = renderHand;
renderHand = function() {
  __origRenderHand();
  if (handTitle) {
    const n = handSizeForEvent(currentEvent);
    handTitle.textContent = `Your Hand (${n})`;
  }
  initPerLifeMeta();
  if (handTokensEl) {
    const tok = state?.metaPerLife?.redrawTokens ?? 0;
    const mull = bigUnlocked("b_fate_stitching") ? (state?.metaPerLife?.mulliganUsed ? "used" : "ready") : "locked";
    handTokensEl.textContent = `Redraw tokens: ${tok} • Mulligan: ${mull}`;
  }
  if (btnRedrawHand) {
    const tok = state?.metaPerLife?.redrawTokens ?? 0;
    btnRedrawHand.disabled = !currentEvent || tok <= 0 || Boolean(state?.metaPerLife?.redrawUsedThisEvent);
  }
  if (btnMulliganHand) {
    const ok = bigUnlocked("b_fate_stitching") && !Boolean(state?.metaPerLife?.mulliganUsed);
    btnMulliganHand.disabled = !currentEvent || !ok;
  }
};

// Inject branch success bonus by wrapping applyBundle at the moment we call it would be risky.
// Instead, we patch openResultModal payload by adding the bonuses immediately after resolution.
// The safest hook point is right after saveState() / renderAll() in resolveSelectedOutcome; we do this by wrapping openResultModal.
const __origOpenResultModal = openResultModal;
openResultModal = function(opts) {
  try {
    // Apply branch success bonus if the last roll was a success and we have a currentEvent cached.
    // The engine logs success earlier, so we infer from the title label.
    const success = (opts?.title ?? "").includes("Success");
    const bonus = legacySuccessBonusBundle(currentEvent, success);
    if (bonus && success) {
      applyBundle(bonus);
      // Also add to the displayed resources list if possible (best-effort).
      try {
        const sum = summarizeBundleForPlayer(bonus);
        if (sum?.resources?.length) {
          opts.resources = [...(opts.resources ?? []), ...sum.resources];
        }
      } catch {}
    }
  } catch {}
  return __origOpenResultModal(opts);
};


// === BEGIN Heirloom Patch Pass 2 (Bank, Pair Bonuses, Exhaust, Background Styles, Loader Fix) ===
;(function(){
  // Optional UI nodes (may be absent in older HTML)
  const bgStyleField = document.getElementById("bgStyleField");
  const bgStyleSelect = document.getElementById("bgStyleSelect");
  const bgStyleHint = document.getElementById("bgStyleHint");
  const pairBonusLine = document.getElementById("pairBonusLine");

  // --- Save migration ---
  const __origLoadState = loadState;
  loadState = function() {
    const ok = __origLoadState();
    if (!ok) return false;
    try {
      state.bankedCardCid ??= null;
      state.exhaustedCards = Array.isArray(state.exhaustedCards) ? state.exhaustedCards : [];
    } catch {}
    return true;
  };

  // --- Data loading: keep JSON base path aligned ---
  loadAllData = async function() {
    const bases = [
      { cards: "./cards.json", events: "./events.json", backgrounds: "./backgrounds_p2.json" },
      { cards: "./cards.json", events: "./events.json", backgrounds: "./backgrounds.json" },
      { cards: "./data/cards.json", events: "./data/events.json", backgrounds: "./data/backgrounds_p2.json" },
      { cards: "./data/cards.json", events: "./data/events.json", backgrounds: "./data/backgrounds.json" }
    ];
    let lastErr = null;
    for (const b of bases) {
      try {
        const [cards, events, backgrounds, factions, ambitionsRaw] = await Promise.all([
          fetchJson(b.cards),
          fetchJson(b.events),
          fetchJson(b.backgrounds),
          fetchJsonAny(["./data/factions.json", "./factions.json"]).catch(() => ([])),
          fetchJsonAny(["./data/ambitions.json", "./ambitions.json"]).catch(() => (null))
        ]);

        DATA.cards = cards;
        ensureThreeLevelCards(DATA.cards);
        DATA.events = events;
        DATA.backgrounds = backgrounds;
        DATA.factions = (Array.isArray(factions) && factions.length) ? factions : DEFAULT_FACTIONS;
        const ambNorm = normalizeAmbitionsJson(ambitionsRaw);
        DATA.ambitionsMeta = ambNorm.meta;
        DATA.ambitions = ambNorm.ambitions;

        indexData();
        annotateEventSignals();
        DATA.storylineMetaById = null;

        // Validate decks (supports deck OR coreDeck+styles)
        for (const bg of DATA.backgrounds) {
          const deckIds = [];
          if (bg?.coreDeck && Array.isArray(bg.styles) && bg.styles.length) {
            deckIds.push(...expandDeck(bg.coreDeck));
            for (const s of bg.styles) deckIds.push(...expandDeck(s?.deck));
          } else {
            deckIds.push(...expandDeck(bg.deck));
          }
          for (const cid of deckIds) {
            if (cid && !DATA.cardsById[cid]) {
              console.warn(`Background ${bg.id} references missing cardId: ${cid}`);
            }
          }
        }

        for (const ev of DATA.events) {
          const n = ev.outcomes?.length ?? 0;
          if (n < 2 || n > 5) console.warn(`Event ${ev.id} should have 2–5 outcomes (has ${n}).`);
        }

        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw (lastErr ?? new Error("Failed to load data JSON"));
  };

  // --- Background styles (Core 6 + Style 6) ---
  creation.bgStyleId ??= null;

  function bgStyles(bg) {
    return Array.isArray(bg?.styles) ? bg.styles : [];
  }

  function bgHasStyles(bg) {
    return Boolean(bg?.coreDeck && bgStyles(bg).length);
  }

  
function inferStyleDesc(label) {
  const s = (label ?? "").toString().toLowerCase();
  if (!s) return "";
  if (s.includes("patron")) return "Courtly leverage: favors, Influence, and polished Seal/Quill lines.";
  if (s.includes("scheme") || s.includes("schemer")) return "Quiet knives: Secrets, Veil plays, and scandal control.";
  if (s.includes("tourney") || s.includes("tournament")) return "Steel-forward: Strife, Renown, and physical edge.";
  if (s.includes("pilgrim") || s.includes("vigil")) return "Endurance and mercy: Hearth/Quill, recovery, and hard choices.";
  if (s.includes("outlaw") || s.includes("shadow")) return "Underworld angles: Veil/Steel, heat, and high-risk shortcuts.";
  return "A themed 6-card variant that shifts your early options and event solutions.";
}

function syncBgStyleUI(bg) {
    if (!bgStyleField || !bgStyleSelect) return;

    if (!bgHasStyles(bg)) {
      bgStyleField.style.display = "none";
      bgStyleSelect.innerHTML = "";
      if (bgStyleHint) bgStyleHint.textContent = "";
      creation.bgStyleId = null;
      return;
    }

    const styles = bgStyles(bg);

    bgStyleField.style.display = "";
    bgStyleSelect.innerHTML = "";

    for (const s of styles) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      bgStyleSelect.appendChild(opt);
    }

    const chosen = (creation.bgStyleId && styles.some(s => s.id === creation.bgStyleId))
      ? creation.bgStyleId
      : styles[0].id;

    bgStyleSelect.value = chosen;
    creation.bgStyleId = chosen;

    const curStyle = styles.find(s => s.id === chosen);
        if (bgStyleHint) {
      const desc = (curStyle?.desc ? curStyle.desc : inferStyleDesc(curStyle?.name || curStyle?.id));
      bgStyleHint.textContent = desc || "Core 6 + Style 6 (12 cards).";
    }
  }

  function starterDeckFromBackground(bg, styleId) {
    if (bgHasStyles(bg)) {
      const core = expandDeck(bg.coreDeck);
      const styles = bgStyles(bg);
      const chosen = styles.find(s => s.id === styleId) || styles[0];
      const styleDeck = expandDeck(chosen?.deck);
      const deckIds = normalizeStarterDeck([...core, ...styleDeck]);
      return { deckIds, styleId: chosen?.id ?? null, styleName: chosen?.name ?? null };
    }
    const deckIds = normalizeStarterDeck(expandDeck(bg.deck));
    return { deckIds, styleId: null, styleName: null };
  }

  const __origRenderCreationUI = renderCreationUI;
  renderCreationUI = function() {
    try {
      const bg = DATA?.backgroundsById?.[bgSelect?.value];
      if (bg) syncBgStyleUI(bg);
    } catch {}
    return __origRenderCreationUI();
  };

  const __origResetCreation = resetCreation;
  resetCreation = function() {
    __origResetCreation();
    creation.bgStyleId = null;
    try {
      const bg = DATA?.backgroundsById?.[bgSelect?.value];
      if (bg) syncBgStyleUI(bg);
    } catch {}
  };

  if (bgStyleSelect) {
    bgStyleSelect.addEventListener("change", () => {
      creation.bgStyleId = bgStyleSelect.value;
      renderCreationUI();
      try { updateStartButtonState(); } catch {}
    });
  }

  const __origStartRunFromBuilder = startRunFromBuilder;
  startRunFromBuilder = function(bg, given, family) {
    const info = starterDeckFromBackground(bg, creation.bgStyleId);
    const bgProxy = Object.assign({}, bg, { deck: info.deckIds });

    __origStartRunFromBuilder(bgProxy, given, family);

    // ensure new state fields exist
    try {
      state.backgroundStyleId = info.styleId;
      state.backgroundStyleName = info.styleName;
      state.bankedCardCid ??= null;
      state.exhaustedCards = Array.isArray(state.exhaustedCards) ? state.exhaustedCards : [];
      saveState();
    } catch {}
  };

  // --- Bank 1 card between events ---
  function openBankModal(onDone) {
    const candidates = Array.isArray(hand) ? hand.slice() : [];
    if (!candidates.length) { onDone?.(); return; }

    let decided = false;

    const wrap = document.createElement("div");
    const p = document.createElement("p");
    p.className = "muted";
    p.innerHTML = "Bank up to <b>1</b> card from your remaining hand. It will appear at the start of your next event.";
    wrap.appendChild(p);

    const spacer = document.createElement("div");
    spacer.className = "spacer";
    wrap.appendChild(spacer);

    const list = document.createElement("div");
    list.className = "outcomes";

    for (const entry of candidates) {
      const c = DATA.cardsById[entry.cid];
      if (!c) continue;
      const btn = document.createElement("button");
      btn.className = "btn ghost";
      btn.textContent = `${c.name} — ${c.discipline}`;
      btn.addEventListener("click", () => {
        if (decided) return;
        decided = true;
        state.bankedCardCid = entry.cid;
        for (const e of hand) {
          if (!e?.cid) continue;
          if (e.iid === entry.iid) continue;
          state.discardPile.push(e.cid);
        }
        hand = [];
        committed = [];
        selectedOutcomeIndex = null;
        saveState();
        renderAll();
        closeModal();
        onDone?.();
      });
      list.appendChild(btn);
    }

    wrap.appendChild(list);

    const row = document.createElement("div");
    row.className = "row gap";
    row.style.marginTop = "10px";

    const skip = document.createElement("button");
    skip.className = "btn";
    skip.textContent = "Skip";
    skip.addEventListener("click", () => {
      if (decided) return;
      decided = true;
      for (const e of hand) if (e?.cid) state.discardPile.push(e.cid);
      hand = [];
      committed = [];
      selectedOutcomeIndex = null;
      saveState();
      renderAll();
      closeModal();
      onDone?.();
    });

    row.appendChild(skip);
    wrap.appendChild(row);

    openModal("Bank 1 card (optional)", wrap, {
      locked: false,
      onClose: () => {
        if (decided) return;
        for (const e of hand) if (e?.cid) state.discardPile.push(e.cid);
        hand = [];
        committed = [];
        selectedOutcomeIndex = null;
        saveState();
        renderAll();
        onDone?.();
      }
    });
  }

  // --- Pair bonuses ---
  function computePairBonus(ev, outcome, committedCids) {
    if (!ev || !outcome) return null;
    if (!Array.isArray(committedCids) || committedCids.length !== 2) return null;
    const a = DATA.cardsById[committedCids[0]];
    const b = DATA.cardsById[committedCids[1]];
    if (!a || !b) return null;
    if (isWildCard(a) || isWildCard(b)) return null;

    const ctx = ev.context;
    const da = a.discipline;
    const db = b.discipline;
    if (!da || !db) return null;

    if (da === db) {
      return { label: `Two ${da} (+3%)`, chanceBonus: 3, onSuccessResources: null, mortalityMitigation: 0 };
    }

    const key = [da, db].sort().join("+");
    const inCtx = (allowed) => allowed.includes(ctx);

    if (key === ["Quill","Seal"].sort().join("+") && inCtx(["Court","Lore"])) {
      return { label: "Seal + Quill (+5%)", chanceBonus: 5, onSuccessResources: null, mortalityMitigation: 0 };
    }
    if (key === ["Hearth","Steel"].sort().join("+") && inCtx(["Strife","Journey"])) {
      return { label: "Steel + Hearth (+5%)", chanceBonus: 5, onSuccessResources: null, mortalityMitigation: 0 };
    }
    if (key === ["Quill","Veil"].sort().join("+") && inCtx(["Scheme","Lore"])) {
      return { label: "Veil + Quill (+1 Secrets on success)", chanceBonus: 0, onSuccessResources: [{ resource: "Secrets", amount: 1 }], mortalityMitigation: 0 };
    }
    if (key === ["Seal","Veil"].sort().join("+") && inCtx(["Court","Scheme"])) {
      return { label: "Veil + Seal (+1 Influence on success)", chanceBonus: 0, onSuccessResources: [{ resource: "Influence", amount: 1 }], mortalityMitigation: 0 };
    }
    if (key === ["Hearth","Quill"].sort().join("+")) {
      return { label: "Quill + Hearth (−1% mortality this event)", chanceBonus: 0, onSuccessResources: null, mortalityMitigation: 1 };
    }
    if (key === ["Steel","Veil"].sort().join("+") && inCtx(["Strife","Scheme"])) {
      return { label: "Steel + Veil (+1 Renown on success)", chanceBonus: 0, onSuccessResources: [{ resource: "Renown", amount: 1 }], mortalityMitigation: 0 };
    }

    return null;
  }

  const __origComputeChanceParts = computeChanceParts;
  computeChanceParts = function(outcome, committedCids, opts = {}) {
    const parts = __origComputeChanceParts(outcome, committedCids, opts);

    // Pair bonuses are small and only apply when 2 legal cards are committed.
    // Apply as an additive % bonus to the underlying roll chance.
    try {
      const ev = opts.ev ?? currentEvent;
      const cards = Array.isArray(committedCids) ? committedCids : [];
      const pair = computePairBonus(ev, outcome, cards);
      const pairChance = pair?.chanceBonus ?? 0;

      parts.pairBonus = pairChance;
      parts.pairLabel = pair?.label ?? "";

      if (typeof parts.raw !== "number") parts.raw = Number(parts.chance ?? 0);
      parts.raw = (parts.raw ?? 0) + pairChance;
      parts.chance = clamp(parts.raw, 5, 95);
    } catch {}

    return parts;
  };

  const __origRenderChance = renderChance;
  renderChance = function() {
    __origRenderChance();
    if (!pairBonusLine) return;

    if (selectedOutcomeIndex == null) {
      pairBonusLine.textContent = "";
      return;
    }

    const o = currentEvent?.outcomes?.[selectedOutcomeIndex];
    const ids = committedCardIds();
    const pair = computePairBonus(currentEvent, o, ids);
    pairBonusLine.textContent = (pair && ids.length === 2) ? `Pair Bonus: ${pair.label}` : "";
  };

  // --- Mortality mitigation hook ---
  computeMortalityChance = function(extraMitigation = 0) {
    let chance = baseMortalityByAge(state.age);
    for (const c of state.conditions) chance += conditionMortalityBonus(c);
    chance -= (MORTALITY_RESOLVE_MULT * (state.stats.Resolve ?? 0));
    chance -= Math.max(0, extraMitigation || 0);
    return Math.max(0, chance);
  };

  // --- Exhaust (5 years = 10 events) ---
  function cardExhaustTurns(cid) {
    const c = DATA.cardsById[cid];
    if (!c) return 0;
    const lvl = getCardLevelData(c);
    const turns = lvl?.exhaustTurns ?? c.exhaustTurns;
    const years = lvl?.exhaustYears ?? c.exhaustYears;
    if (Number.isFinite(turns) && turns > 0) return Math.floor(turns);
    if (Number.isFinite(years) && years > 0) return Math.floor(years) * 2;

    const kws = lvl?.keywords || c.keywords || c.tags || [];
    if (Array.isArray(kws)) {
      if (kws.includes("Exhaust5")) return 10;
      if (kws.includes("Exhaust10")) return 20;
    }

    return 0;
  }

  function exhaustCardInstance(cid, turns) {
    state.exhaustedCards = Array.isArray(state.exhaustedCards) ? state.exhaustedCards : [];
    const now = state.lifetimeEvents ?? 0;
    const returnAt = now + turns;

    // Remove one instance from master deck (if present)
    let removed = false;
    if (Array.isArray(state.masterDeck)) {
      const idx = state.masterDeck.indexOf(cid);
      if (idx >= 0) {
        state.masterDeck.splice(idx, 1);
        removed = true;
      }
    }

    // Safety: remove from draw/discard if present
    if (Array.isArray(state.drawPile)) {
      const idx = state.drawPile.indexOf(cid);
      if (idx >= 0) state.drawPile.splice(idx, 1);
    }
    if (Array.isArray(state.discardPile)) {
      const idx = state.discardPile.indexOf(cid);
      if (idx >= 0) state.discardPile.splice(idx, 1);
    }

    if (removed) state.exhaustedCards.push({ cid, returnAt });

    const years = Math.floor(turns / 2);
    const returnAge = (state.age ?? 16) + years;
    return { returnAge, removed };
  }

  function tickExhaustedCards() {
    if (!state || !Array.isArray(state.exhaustedCards) || state.exhaustedCards.length === 0) return;
    const now = state.lifetimeEvents ?? 0;
    const ready = state.exhaustedCards.filter(e => (e?.returnAt ?? Infinity) <= now);
    if (!ready.length) return;

    state.exhaustedCards = state.exhaustedCards.filter(e => (e?.returnAt ?? Infinity) > now);

    for (const e of ready) {
      const cid = e.cid;
      if (!cid) continue;
      state.masterDeck = Array.isArray(state.masterDeck) ? state.masterDeck : [];
      state.discardPile = Array.isArray(state.discardPile) ? state.discardPile : [];
      state.masterDeck.push(cid);
      state.discardPile.push(cid);
      const c = DATA.cardsById[cid];
      log(`⏳ Exhaust ends: ${c?.name ?? cid} returns to your deck.`);
    }
  }

  const __origAdvanceTime = advanceTime;
  advanceTime = function() {
    __origAdvanceTime();
    try { tickExhaustedCards(); } catch (e) { console.error(e); }
  };

  // --- Deck integrity: exclude banked card when refilling ---
  ensureDeckIntegrity = function(reason = "") {
    if (!state) return;

    state.drawPile = Array.isArray(state.drawPile) ? state.drawPile : [];
    state.discardPile = Array.isArray(state.discardPile) ? state.discardPile : [];
    state.masterDeck = Array.isArray(state.masterDeck) ? state.masterDeck : [];

    // If masterDeck is missing, rebuild from piles + banked card.
    if (state.masterDeck.length === 0) {
      const combined = [...state.drawPile, ...state.discardPile];
      if (state.bankedCardCid) combined.push(state.bankedCardCid);
      if (combined.length) state.masterDeck = [...combined];
    }

    if (state.drawPile.length === 0 && state.discardPile.length === 0 && state.masterDeck.length) {
      const refill = [...state.masterDeck];
      if (state.bankedCardCid) {
        const idx = refill.indexOf(state.bankedCardCid);
        if (idx >= 0) refill.splice(idx, 1);
      }
      state.drawPile = shuffle(refill);
      state.discardPile = [];
      if (reason) console.warn("Deck integrity refill:", reason);
    }
  };

  // Override drawHand to include a banked card
  drawHand = function(n) {
    ensureDeckIntegrity("drawHand");
    hand = [];
    committed = [];

    let toDraw = n;
    if (state?.bankedCardCid) {
      const cid = state.bankedCardCid;
      state.bankedCardCid = null;
      hand.push({ iid: nextHandIid++, cid });
      toDraw = Math.max(0, n - 1);
    }

    for (let i = 0; i < toDraw; i++) {
      if (state.drawPile.length === 0) {
        state.drawPile = shuffle(state.discardPile);
        state.discardPile = [];
      }
      if (state.drawPile.length === 0) break;
      const cid = state.drawPile.pop();
      hand.push({ iid: nextHandIid++, cid });
    }

    saveState();
  };

  // --- Resolution: pair, exhaust, bank ---
  resolveSelectedOutcome = function() {
    if (resolvingOutcome) return;
    if (selectedOutcomeIndex == null) return;

    resolvingOutcome = true;
    btnResolve.disabled = true;
    btnNewEvent.disabled = true;
    btnDebugPickEvent.disabled = true;

    const o = currentEvent.outcomes[selectedOutcomeIndex];
    const evJustResolved = currentEvent;

    const committedCidsSnapshot = committedCardIds();

    // Compute success chance
    const chance = computeChance(o, committedCidsSnapshot);
    const roll = rInt(1, 100);
    const success = roll <= chance;

    // Tracking for result + any post-event modals
    let bundleForSummary = null;
    let isPartial = false;
    let postActions = [];

    // Attempt costs driven by conditions (paid whether you succeed or fail).
    const condRule = outcomeConditionRules(currentEvent, o);
    const attemptCosts = (condRule.costs ?? []).map(c => ({ resource: c.resource, amount: c.amount }));
    const attemptBundle = attemptCosts.length ? { resources: attemptCosts } : null;
    if (attemptBundle) postActions.push(...applyBundle(attemptBundle));

    // Mortality tracking (before any new conditions this event adds)
    const severeBefore = state.conditions.filter(c => c.severity === "Severe").length;

    // Pair bonus (extra success %, resource on success, or mortality mitigation)
    const pair = computePairBonus(currentEvent, o, committedCidsSnapshot);

    // Exhaust on commit + move committed cards to discard (unless exhausted)
    state.exhaustedCards = Array.isArray(state.exhaustedCards) ? state.exhaustedCards : [];
    const exhaustNotes = [];

    const committedSet = new Set(committed);
    for (const iid of committed) {
      const entry = getHandEntry(iid);
      if (!entry?.cid) continue;
      const cid = entry.cid;

      const turns = cardExhaustTurns(cid);
      if (turns > 0) {
        const info = exhaustCardInstance(cid, turns);
        const c = DATA.cardsById[cid];
        if (info.removed) {
          exhaustNotes.push(`Exhausted for ${Math.floor(turns / 2)} years (returns at Age ${info.returnAge}).`);
        }
      } else {
        state.discardPile.push(cid);
      }
    }

    // Unplayed cards remain in hand for Banking.
    hand = hand.filter(h => !committedSet.has(h.iid));

    // Apply outcome effects
    if (success) {
      const cardBundle = bundleFromCommittedCards(committedCidsSnapshot, "onSuccess");
      let merged = mergeBundles(o.success, cardBundle);

      if (pair?.onSuccessResources?.length) {
        merged = mergeBundles(merged, { resources: pair.onSuccessResources });
      }

      postActions.push(...applyBundle(merged));
      bundleForSummary = merged;
      log(`SUCCESS (${roll} <= ${chance}) → ${o.title}`);
    } else {
      const partial = committedCidsSnapshot.some(cid => {
        const c = DATA.cardsById[cid];
        return c ? Boolean(getCardLevelData(c).partialOnFail) : false;
      });

      if (partial) {
        isPartial = true;
        log(`FAIL (${roll} > ${chance}) but PARTIAL triggers → ${o.title}`);

        const halfResources = [];
        for (const d of (o.success?.resources ?? [])) {
          const half = Math.trunc((d.amount ?? 0) / 2);
          halfResources.push({ resource: d.resource, amount: half });
        }

        const softenedConds = [];
        for (const c of (o.fail?.conditions ?? [])) {
          const sev = (c.severity === "Severe") ? "Minor" : (c.severity ?? "Minor");
          softenedConds.push({ ...c, severity: sev });
        }

        const baseTxt = (o.fail?.text ?? '').trim() || (o.success?.text ?? '').trim();
        const partialTxt = baseTxt
          ? (baseTxt + "\n\nStill, you salvage what you can.")
          : "You don’t quite get what you wanted, but you salvage something.";

        let partialBundle = { text: partialTxt, resources: halfResources, conditions: softenedConds };
        partialBundle = mitigateFailBundle(partialBundle, currentEvent, o, committedCidsSnapshot, { isPartial: true });

        const cardBundle = bundleFromCommittedCards(committedCidsSnapshot, "onFailure");

        const merged = mergeBundles(partialBundle, cardBundle);
        postActions.push(...applyBundle(merged));
        bundleForSummary = merged;
      } else {
        const failBundle = mitigateFailBundle(o.fail, currentEvent, o, committedCidsSnapshot);
        const cardBundle = bundleFromCommittedCards(committedCidsSnapshot, "onFailure");
        const merged = mergeBundles(failBundle, cardBundle);
        postActions.push(...applyBundle(merged));
        bundleForSummary = merged;
        log(`FAIL (${roll} > ${chance}) → ${o.title}`);
      }
    }

    // Post-event pressure from active conditions (upkeep, drains, heat, etc.)
    const combinedForNet = mergeBundles(attemptBundle, bundleForSummary);
    const netDeltas = bundleNetResourceDeltas(combinedForNet);
    const postPressure = applyPostEventConditionPressure(currentEvent, o, success, isPartial, netDeltas);
    if (postPressure) postActions.push(...applyBundle(postPressure));

    const bundleForResult = mergeBundles(mergeBundles(attemptBundle, bundleForSummary), postPressure);

    // Mortality triggers (design rules)
    const wasMajor = currentEvent.kind === "major";
    let secondBreathNote = "";

    // Earn Scrip even if a mortality check kills you.
    awardScripForResolvedEvent(evJustResolved, wasMajor);
    const perilous = (o.tags ?? []).includes("Perilous");

    const severeAfter = state.conditions.filter(c => c.severity === "Severe").length;
    const gainedSevere = severeAfter > severeBefore;
    const hadSevereAlready = severeBefore > 0;

    let mortalityTriggered = false;
    if (wasMajor) mortalityTriggered = true;
    if (perilous) mortalityTriggered = true;
    if (gainedSevere && hadSevereAlready) mortalityTriggered = true;

    if (mortalityTriggered) {
      const mitigation = pair?.mortalityMitigation ?? 0;
      const mChance = computeMortalityChance(mitigation);
      const mRoll = rInt(1, 100);
      log(`Mortality Check: ${mChance}% (roll ${mRoll})`);
      if (mRoll <= mChance) {
        // Second Breath: intercept one fatal Mortality Check per life.
        if (bigUnlocked("b_second_breath")) {
          initPerLifeMeta();
          if (!state.metaPerLife.secondBreathUsed) {
            state.metaPerLife.secondBreathUsed = true;
            const pick = (currentEvent?.context === "Strife") ? "Wounded" : "Ill";
            addCondition(pick, "Severe", { source: "Second Breath" });
            state.res.Coin = clamp((state.res.Coin ?? 0) - 3, 0, 99);
            state.res.Supplies = clamp((state.res.Supplies ?? 0) - 3, 0, 99);
            secondBreathNote = `Second Breath kept you standing. (-3 Coin, -3 Supplies, +Severe ${pick})`;
            log(`✦ Second Breath: you live. (Roll ${mRoll} <= ${mChance})`);
          } else {
            log(`💀 Death claims you at age ${state.age}.`);
            resolvingOutcome = false;
            btnNewEvent.disabled = false;
            btnDebugPickEvent.disabled = false;
            handleDeath();
            return;
          }
        } else {
          log(`💀 Death claims you at age ${state.age}.`);
          resolvingOutcome = false;
          btnNewEvent.disabled = false;
          btnDebugPickEvent.disabled = false;
          handleDeath();
          return;
        }
      }
    }

    // Cleanup (exactly once per resolved event)
    tickFlags();
    committed = [];
    selectedOutcomeIndex = null;

    // Result modal -> bank modal -> (Major? draft modal) -> finishEvent()
    const outcomeLabel = success ? "Success" : (isPartial ? "Partial" : "Failure");
    const subtitle = success
      ? `Success! You pursued: ${o.title}`
      : (isPartial ? `Partial success. You pursued: ${o.title}` : `Failure. You pursued: ${o.title}`);

    let narrativeBase = (bundleForResult?.text ?? "").trim() || defaultResultNarrative(currentEvent, o, success, isPartial);
    if (exhaustNotes.length) narrativeBase = `${narrativeBase}\n\n${exhaustNotes.join("\n")}`;
    const narrative = secondBreathNote ? `${narrativeBase}\n\n${secondBreathNote}` : narrativeBase;

    const { resources, conditions } = summarizeBundleForPlayer(bundleForResult);

    saveState();
    renderAll();

    openResultModal({
      title: `Outcome: ${outcomeLabel}`,
      subtitle,
      narrative,
      resources,
      conditions,
      locked: false,
      onClose: () => {
        const safeFinish = () => {
          try {
            finishEvent(evJustResolved);
          } catch (e) {
            console.error("finishEvent crashed (emergency unlock):", e);
            resolvingOutcome = false;
            btnNewEvent.disabled = false;
            btnDebugPickEvent.disabled = false;
            try { beginEvent(makeFallbackEvent("finishEvent error")); } catch {}
          }
        };

        const afterBank = () => {
          const afterPost = () => {
            if (wasMajor) {
              let advanced = false;
              const done = () => {
                if (advanced) return;
                advanced = true;
                safeFinish();
              };
              try {
                openDraftModal(() => done());
              } catch (e) {
                console.error("Draft modal error (skipping draft):", e);
                done();
              }

              if (modalBackdrop.classList.contains("hidden")) {
                console.warn("Draft modal did not open; advancing to avoid softlock.");
                done();
              }
            } else {
              safeFinish();
            }
          };

          try {
            runPostActionsSequentially(postActions, afterPost);
          } catch (e) {
            console.error("Post-action chain failed (skipping):", e);
            afterPost();
          }
        };

        // Banking happens after results, before post-actions and time advance.
        openBankModal(afterBank);
      }
    });
  };
})();
// === END Heirloom Patch Pass 2 ===


boot();

// === END core app ===

// === BEGIN ui enhancements (wrapped) ===

;(function(){
  function __run_ui_helpers__(){
/* Heirloom UI Enhancements (non-invasive)
   - Improves Run Creation UX without touching game logic.
   - Works with any app.js that renders #traitsList as:
       <label class="traitRow"><input type="checkbox" ...> ...</label>
*/

(() => {
  const traitsList = document.getElementById("traitsList");
  const traitsPickedEl = document.getElementById("traitsPicked");
  const btnStart = document.getElementById("btnStart");

  // Only needed on the start screen.
  if (!traitsList || !btnStart) return;

  const refresh = () => {
    const boxes = Array.from(traitsList.querySelectorAll("input[type='checkbox']"));
    if (!boxes.length) return;

    const selected = boxes.filter(b => b.checked).length;
    if (traitsPickedEl) traitsPickedEl.textContent = String(selected);

    // Make the "pick 2" rule visible:
    // - once you have 2, other boxes become disabled (still un-disable if you uncheck)
    const lock = selected >= 2;
    for (const box of boxes) {
      const shouldDisable = lock && !box.checked;
      box.disabled = shouldDisable;

      const label = box.closest("label");
      if (label) {
        label.classList.toggle("disabled", shouldDisable);
      }
    }

    // Let app.js own the Start button gating (name + points + traits).
    // We only handle trait-locking + picked count here.
  };

  // Observe re-renders from app.js.
  const obs = new MutationObserver(() => refresh());
  obs.observe(traitsList, { childList: true, subtree: true });

  // Also update on user changes.
  traitsList.addEventListener("change", refresh);

  // Initial.
  refresh();
})();

  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __run_ui_helpers__, { once: true });
  } else { __run_ui_helpers__(); }
})();
// === END ui enhancements ===
