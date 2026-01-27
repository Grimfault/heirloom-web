/* Heirloom Web Prototype v0.1 (Data-driven)
   - Loads: ./data/cards.json, ./data/events.json, ./data/backgrounds.json
   - Supports: requirements → disabled outcomes with reasons
   - Card levels: uses level 1 by default (upgrade-ready later)
*/
console.log("✅ app.js loaded");

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const deepCopy = (obj) => (obj == null ? null : JSON.parse(JSON.stringify(obj)));

const MAJOR_AGES = new Set([20,25,30,35,40,45,50]);
const SEASONS = ["Vernal", "Autumnal"];
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
  cardsById: {},
  eventsById: {},
  backgroundsById: {}
};

// ---------- DOM ----------
const elStart = document.getElementById("startScreen");
const elGame = document.getElementById("gameScreen");
const bgSelect = document.getElementById("bgSelect");
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");
const btnResolve = document.getElementById("btnResolve");
const btnNewEvent = document.getElementById("btnNewEvent");
const btnDebugPickEvent = document.getElementById("btnDebugPickEvent");

const charNameInput = document.getElementById("charName");
const familyNameInput = document.getElementById("familyName");
const allocRemainingEl = document.getElementById("allocRemaining");
const allocGrid = document.getElementById("allocGrid");
const traitsListEl = document.getElementById("traitsList");

const statusLine = document.getElementById("statusLine");
const statsLine = document.getElementById("statsLine");
const resourceLine = document.getElementById("resourceLine");
const conditionLine = document.getElementById("conditionLine");
const majorPill = document.getElementById("majorPill");

const eventName = document.getElementById("eventName");
const eventMeta = document.getElementById("eventMeta");
const eventPrompt = document.getElementById("eventPrompt");
const outcomesEl = document.getElementById("outcomes");

const handEl = document.getElementById("hand");
const handHint = document.getElementById("handHint");
const slot1 = document.getElementById("slot1");
const slot2 = document.getElementById("slot2");

const chanceLine = document.getElementById("chanceLine");
const chanceBreakdown = document.getElementById("chanceBreakdown");
const logEl = document.getElementById("log");

const bootMsg = document.getElementById("bootMsg");
const setBootMsg = (msg) => { if (bootMsg) bootMsg.textContent = msg || ""; };

const START_ALLOC_POINTS = 4;
const STAT_CAP = 5;

const STARTING_AGE = 16;
const MAX_MARRIAGE_AGE = 45;

const TRAITS = [
  // Stat-edge
  { id: "brawny", name: "Brawny", desc: "+1 Might (cap 5).", statMods: { Might: 1 } },
  { id: "bookish", name: "Bookish", desc: "+1 Wit (cap 5).", statMods: { Wit: 1 } },
  { id: "silver_tongue", name: "Silver Tongue", desc: "+1 Gravitas (cap 5).", statMods: { Gravitas: 1 } },
  { id: "shadow_eyed", name: "Shadow-Eyed", desc: "+1 Guile (cap 5).", statMods: { Guile: 1 } },
  { id: "stubborn", name: "Stubborn", desc: "+1 Resolve (cap 5).", statMods: { Resolve: 1 } },

  // Starts-with resources
  { id: "well_connected", name: "Well-Connected", desc: "Start with +1 Influence.", resMods: { Influence: 1 } },
  { id: "thrifty", name: "Thrifty", desc: "Start with +2 Coin.", resMods: { Coin: 2 } },
  { id: "packer", name: "Packer", desc: "Start with +2 Supplies.", resMods: { Supplies: 2 } },
  { id: "known_face", name: "Known Face", desc: "Start with +1 Renown.", resMods: { Renown: 1 } },
  { id: "quiet_sins", name: "Quiet Sins", desc: "Start with +1 Secrets.", resMods: { Secrets: 1 } },

  // Risky starts
  { id: "notorious", name: "Notorious", desc: "Start +1 Renown, +1 Secrets, but gain Marked (Minor).",
    resMods: { Renown: 1, Secrets: 1 },
    addConditions: [{ id: "Marked", severity: "Minor" }]
  },
  { id: "debt_ridden", name: "Debt-Ridden", desc: "Start with +4 Coin, but gain In Debt (Minor).",
    resMods: { Coin: 4 },
    addConditions: [{ id: "In Debt", severity: "Minor" }]
  },

  // Flavorful, tangible nudges (still simple in this prototype)
  { id: "hardy", name: "Hardy", desc: "Start with +1 Resolve and +1 Supplies.", statMods: { Resolve: 1 }, resMods: { Supplies: 1 } },
  { id: "meticulous", name: "Meticulous", desc: "Start with +1 Wit and +1 Influence.", statMods: { Wit: 1 }, resMods: { Influence: 1 } },
  { id: "ruthless", name: "Ruthless", desc: "Start with +1 Guile and +1 Secrets.", statMods: { Guile: 1 }, resMods: { Secrets: 1 } },
  { id: "charming", name: "Charming", desc: "Start with +1 Gravitas and +1 Renown.", statMods: { Gravitas: 1 }, resMods: { Renown: 1 } },
  { id: "oathbound", name: "Oathbound", desc: "Start with Oathbound (Minor) and +1 Influence.", resMods: { Influence: 1 }, addConditions: [{ id: "Oathbound", severity: "Minor" }] },
  { id: "streetwise", name: "Streetwise", desc: "Start with +1 Guile and +1 Coin.", statMods: { Guile: 1 }, resMods: { Coin: 1 } },
  { id: "steadfast", name: "Steadfast", desc: "Start with +2 Resolve.", statMods: { Resolve: 2 } },

  // Courtship-relevant starts
  { id: "fine_clothes", name: "Fine Clothes", desc: "Start with +2 Coin and +1 Gravitas.", resMods: { Coin: 2 }, statMods: { Gravitas: 1 } },
  { id: "devout", name: "Devout", desc: "Start with +1 Resolve and +1 Influence.", statMods: { Resolve: 1 }, resMods: { Influence: 1 } }
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
function difficultyProfileForEvent(ev, opts = {}) {
  // defaults: "general"
  // NOTE: "majorBeat" lets you make the 5-year milestones feel tougher even if the event JSON is still kind:"general"
  const majorBeat = Boolean(opts.majorBeat);
  const kind = majorBeat ? "major" : (ev.kind ?? "general"); // later: "major", "faction"
  if (kind === "general") return { base: 60, statMult: 9, diffMult: 8 };
  if (kind === "faction")  return { base: 55, statMult: 9, diffMult: 10 };
  if (kind === "major")    return { base: 50, statMult: 8, diffMult: 11 };
  return { base: 55, statMult: 8, diffMult: 10 };
}

function computeChance(outcome, committedCids) {
  const statVal = state.stats[outcome.stat] ?? 0;
  const diff = outcome.diff ?? 3;

  const cardBonus = (committedCids ?? []).reduce((sum, cid) => {
    const c = DATA.cardsById[cid];
    if (!c) return sum;
    return sum + (getCardLevelData(c).bonus ?? 0);
  }, 0);

  const prof = difficultyProfileForEvent(currentEvent);
  let chance = prof.base + (statVal * prof.statMult) + cardBonus - (diff * prof.diffMult);
  chance = clamp(chance, 5, 95);
  return Math.round(chance);
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
  // 1 arrow per 5% bonus
  const n = Math.max(0, Math.floor((bonusPct ?? 0) / 5));
  return "↑".repeat(n);
}

let creation = {
  bgId: null,
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

let resolvingOutcome = false; // prevents double-advances / modal-close weirdness
let draftOpened = false; // guards major draft double-open

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
  chance -= (2 * (state.stats.Resolve ?? 0));
  return Math.max(0, chance);
}

// ---------- Data loading ----------
async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.json();
}

function indexData() {
  DATA.cardsById = Object.fromEntries(DATA.cards.map(c => [c.id, c]));
  DATA.eventsById = Object.fromEntries(DATA.events.map(e => [e.id, e]));
  DATA.backgroundsById = Object.fromEntries(DATA.backgrounds.map(b => [b.id, b]));
}

async function loadAllData() {
  const [cards, events, backgrounds] = await Promise.all([
    fetchJson("./data/cards.json"),
    fetchJson("./data/events.json"),
    fetchJson("./data/backgrounds.json")
  ]);

  DATA.cards = cards;
  DATA.events = events;
  DATA.backgrounds = backgrounds;
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
    return v >= (req.min ?? 0);
  }
  if (t === "MinResource") {
    const v = state.res[req.resource] ?? 0;
    return v >= (req.min ?? 0);
  }
  if (t === "HasCondition") return hasCondition(req.id, req.severity ?? "Any");
  if (t === "NotCondition") return !hasCondition(req.id, req.severity ?? "Any");
  if (t === "HasFlag") return Boolean(state.flags?.[req.id]);
  if (t === "NotFlag") return !Boolean(state.flags?.[req.id]);
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
        reasons.push(`Requires flag: ${req.id}`);
        break;
      case "NotFlag":
        reasons.push(`Blocked by flag: ${req.id}`);
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
    case "Common": return 6;
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
  return choices;
}

function openDraftModal(onPicked) {
  const choices = generateDraftChoices(3);

  const wrap = document.createElement("div");
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = "Major milestone! Choose 1 card to add to your deck (it goes into your discard pile).";
  wrap.appendChild(p);

  const list = document.createElement("div");
  list.className = "hand";
  wrap.appendChild(list);

  for (const cid of choices) {
    const c = DATA.cardsById[cid];
    const lvlData = getCardLevelData(c);

    const div = document.createElement("div");
    div.className = "cardbtn";
    div.tabIndex = 0;

    div.innerHTML = `
      <div class="cardname">${c.name}</div>
      <div class="cardmeta">
        <span class="badge">${c.discipline}</span>
        <span class="badge">Contexts: ${(c.contexts ?? []).join(", ")}</span>
        <span class="badge">${arrowsForBonus(lvlData.bonus)}</span>
        <span class="badge">${c.rarity}</span>
      </div>
      <div class="muted">Click to choose</div>
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
      const count = Math.max(1, entry.count ?? 1);
      for (let i = 0; i < count; i++) out.push(entry.cardId ?? entry.id);
    }
    return out;
  }
  return [];
}

function drawHand(n) {
  hand = [];
  for (let i = 0; i < n; i++) {
    if (state.drawPile.length === 0) {
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [];

      // Safety: if both piles are empty (e.g., after rerolls/debug picks),
      // rebuild from the master deck so the run can't softlock.
      if (state.drawPile.length === 0 && Array.isArray(state.masterDeck) && state.masterDeck.length) {
        state.drawPile = shuffle([...state.masterDeck]);
        state.discardPile = [];
      }

      if (state.drawPile.length === 0) break;
    }
    const cid = state.drawPile.pop();
    hand.push({ iid: nextHandIid++, cid });
  }
}

// ---------- Cards ----------
function getCardLevel(cardId) {
  // v0.1: always level 1; later can read meta upgrade map
  return 1;
}

function getCardLevelData(card) {
  const lvl = getCardLevel(card.id);
  const levels = card.levels ?? [];
  const found = levels.find(x => x.level === lvl) || levels[0];
  return found || { level: 1, bonus: 0, partialOnFail: false };
}

function isCardUsable(cardId, outcomeIndex) {
  const card = DATA.cardsById[cardId];
  const o = currentEvent?.outcomes?.[outcomeIndex];
  if (!card || !o) return false;

  const contextOk = (card.contexts ?? []).includes(currentEvent.context);
  const disciplineOk = (o.allowed ?? []).includes(card.discipline);

  return contextOk && disciplineOk;
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
    if (k === "Supplies") addCondition("Starving", "Severe", { source: "floor" });
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
  const list = (actions ?? []).filter(fn => typeof fn === "function");
  let i = 0;
  const step = () => {
    if (i >= list.length) return done?.();
    const fn = list[i++];
    fn(step);
  };
  step();
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
function showStart() {
  elStart.classList.remove("hidden");
  elGame.classList.add("hidden");
  btnNewEvent.disabled = true;
}

function showGame() {
  elStart.classList.add("hidden");
  elGame.classList.remove("hidden");
  btnNewEvent.disabled = false;
}

let modalLocked = false;
let modalOnClose = null;

function openModal(title, bodyEl, opts = {}) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.appendChild(bodyEl);

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

  // Allocation grid
  allocGrid.innerHTML = "";
  const finalStats = computeFinalStats(bg);

  for (const s of STATS) {
    const row = document.createElement("div");
    row.className = "allocRow";

    const startStats = bg.startStats ?? bg.stats ?? {};
      const base = startStats[s] ?? 0;
    const alloc = creation.alloc[s] ?? 0;
    const final = finalStats[s] ?? 0;

    row.innerHTML = `
      <div class="allocStat">${s}</div>
      <div class="allocNums">
        <span class="badge">Base ${base}</span>
        <span class="badge">+${alloc}</span>
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
        if (delta < 0 && (creation.alloc[stat] ?? 0) <= 0) return;

        // prevent exceeding cap (based on base+alloc before trait mods)
        const baseVal = startStats[stat] ?? 0;
        const nextAlloc = (creation.alloc[stat] ?? 0) + delta;
        const capped = clamp(baseVal + nextAlloc, 0, STAT_CAP);

        // if cap prevents the increase, just stop
        if (delta > 0 && capped === STAT_CAP && (baseVal + (creation.alloc[stat] ?? 0)) >= STAT_CAP) return;

        creation.alloc[stat] = Math.max(0, nextAlloc);
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
}


function isMajorEventNow() {
  const season = SEASONS[state.seasonIndex];
  return (season === "Vernal" && MAJOR_AGES.has(state.age));
}

function renderStatus() {
  const season = SEASONS[state.seasonIndex];

  const who = `${state.charName ?? "Unknown"} ${state.familyName ?? ""}`.trim();
    ensureFamilyState();
  const spouseStr = state.family.spouse ? ` • Spouse: ${state.family.spouse.given}` : "";
  const kids = state.family.heirs?.length ?? 0;
  const kidsStr = kids ? ` • Children: ${kids}` : "";
  statusLine.textContent = `${who} • Age ${state.age} • ${season} • Heirs Ruled ${state.heirCount ?? 0}${spouseStr}${kidsStr}`;

  const hf = state.heirFocus ? ` (Heir Focus: ${state.heirFocus})` : "";
  statsLine.textContent =
    `Stats • Might ${state.stats.Might} • Wit ${state.stats.Wit} • Guile ${state.stats.Guile} • Gravitas ${state.stats.Gravitas} • Resolve ${state.stats.Resolve}${hf}`;

  resourceLine.textContent =
    `Coin ${state.res.Coin} • Supplies ${state.res.Supplies} • Renown ${state.res.Renown} • Influence ${state.res.Influence} • Secrets ${state.res.Secrets}`;

  const condStr = state.conditions.length
    ? state.conditions.map(c => `${c.id} (${c.severity})`).join(", ")
    : "None";
  conditionLine.textContent = `Conditions: ${condStr}`;

  majorPill.classList.toggle("show", isMajorEventNow());
}

function renderEvent() {
  eventName.textContent = currentEvent.name;
    ensureFamilyState();
  let meta = `Context: ${currentEvent.context}`;
  if (currentEvent?.storyline?.id === "ct" && state.family.prospect) {
    meta += ` • Prospect: ${state.family.prospect.given} (${state.family.prospect.cultureName})`;
  }
  eventMeta.textContent = meta;
  eventPrompt.textContent = currentEvent.prompt;
}

function renderOutcomes() {
  outcomesEl.innerHTML = "";
  currentEvent.outcomes.forEach((o, idx) => {
    const baseReasons = unmetReasons(o.requirements);
    const cond = outcomeConditionRules(currentEvent, o);
    const reasons = [...baseReasons, ...(cond.reasons ?? [])];
    const attemptCosts = cond.costs ?? [];
    const disabled = reasons.length > 0;

    const div = document.createElement("div");
    div.className = "outcome"
      + (selectedOutcomeIndex === idx ? " selected" : "")
      + (disabled ? " disabled" : "");

    const costText = attemptCosts.length
      ? attemptCosts.map(c => `${fmtDelta(c.amount)} ${c.resource}`).join(", ")
      : "";

    div.innerHTML = `
      <div class="outcome-title">${o.title}</div>
      <div class="muted">${o.desc ?? ""}</div>
      <div class="outcome-meta">
        <span class="badge">Stat: ${o.stat}</span>
        <span class="badge">Diff: ${o.diff}</span>
        <span class="badge">Allows: ${(o.allowed ?? []).join(", ")}</span>
        ${(o.tags?.length ? `<span class="badge">Tags: ${o.tags.join(", ")}</span>` : ``)}
      </div>
      ${attemptCosts.length ? `<div class="muted">Attempt cost: ${costText}</div>` : ``}
      ${disabled ? `<div class="muted">Locked: ${reasons.join(" • ")}</div>` : ``}
    `;

    div.addEventListener("click", () => {
      if (disabled) return;
      selectedOutcomeIndex = idx;
      committed = [];
      renderAll();
    });

    outcomesEl.appendChild(div);
  });

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

  if (selectedOutcomeIndex == null) {
    handHint.textContent = "Pick an outcome to see which cards are playable.";
  } else {
    handHint.textContent = `Tap a playable card to commit/uncommit (max ${cap}).`;
  }

  handEl.innerHTML = "";
  for (const entry of hand) {
    const cid = entry.cid;
    const c = DATA.cardsById[cid];
    if (!c) continue;

    const usable = (selectedOutcomeIndex != null) ? isCardUsable(cid, selectedOutcomeIndex) : false;
    const isCommitted = committed.includes(entry.iid);

    const lvlData = getCardLevelData(c);
    const extra = lvlData.partialOnFail ? "Partial-on-fail" : null;

    const div = document.createElement("div");
    div.className = "cardbtn"
      + (usable ? "" : " disabled")
      + (isCommitted ? " committed" : "");

    div.innerHTML = `
      <div class="cardname">${c.name}</div>
      <div class="cardmeta">
        <span class="badge">${c.discipline}</span>
        <span class="badge">Contexts: ${(c.contexts ?? []).join(", ")}</span>
        <span class="badge arrow">${arrowsForBonus(lvlData.bonus)}</span>
        ${extra ? `<span class="badge">${extra}</span>` : ``}
      </div>
      ${selectedOutcomeIndex != null && !usable ? `<div class="muted">Not usable for this outcome.</div>` : ``}
    `;

    div.addEventListener("click", () => {
      if (selectedOutcomeIndex == null) return;
      if (!usable) return;

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

  if (selectedOutcomeIndex == null) {
    chanceLine.textContent = "Select an outcome.";
    chanceBreakdown.textContent = "";
    return;
  }

  const o = currentEvent.outcomes[selectedOutcomeIndex];
  const statVal = state.stats[o.stat] ?? 0;
  const diff = o.diff ?? 3;

  const cardBonus = committedCardIds().reduce((sum, cid) => {
    const c = DATA.cardsById[cid];
    if (!c) return sum;
    return sum + (getCardLevelData(c).bonus ?? 0);
  }, 0);

const prof = difficultyProfileForEvent(currentEvent, { majorBeat: isMajorEventNow() });
let chance = prof.base + (statVal * prof.statMult) + cardBonus - (diff * prof.diffMult);
chance = clamp(chance, 5, 95);

  const cls = (chance >= 60) ? "good" : (chance <= 35) ? "bad" : "";
  const band = chanceBand(chance);
chanceLine.innerHTML = `Chance: <span class="${cls}">${band}</span>`;
chanceBreakdown.textContent = ""; // hide breakdown for now
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

  // Hard no-repeat window
  const noRepeatWindow = 8;
  if (h.recentEvents?.slice(0, noRepeatWindow).includes(ev.id)) return 0;

  // Soft penalty for overall repeats
  const seen = h.seen?.[ev.id] ?? 0;
  // 0:1.00, 1:0.69, 2:0.53, 3:0.43...
  return 1 / (1 + (0.45 * seen));
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
      m *= state.flags?.[fid] ? 2.0 : 0.7;
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


function pickEventFromPool(pool, avoidIds = [], weightFn = eventDirectorWeight, strictAvoid = false) {
  if (!pool || pool.length === 0) return null;
  const avoid = Array.isArray(avoidIds) ? avoidIds : [];

  const preferred = avoid.length ? pool.filter(e => !avoid.includes(e.id)) : pool;
  if (strictAvoid && avoid.length && preferred.length === 0) return null;

  const picked = weightedPick(preferred, weightFn);
  if (picked) return picked;

  // If all weights were 0, fall back to uniform random among the preferred set.
  if (preferred.length) return pick(preferred);

  // If strictAvoid is false, we can fall back to a repeat.
  return pick(pool);
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
  return Object.keys(DATA.storylineMetaById ?? {}).filter(id => Boolean(state?.flags?.[storyFlag(id, "active")]));
}
function isStoryActive(id) {
  return Boolean(state?.flags?.[storyFlag(id, "active")]);
}
function isStoryDone(id) {
  return Boolean(state?.flags?.[storyFlag(id, "done")]);
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
function pickDueStoryEvent() {
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
      if (state.flags?.ct_declined) w *= 0.35; // cooldown after declining a prospect
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

    if (state.age === 20 && !state.flags?.knot1_done) desiredStage = "knot1";
    if (state.age === 35 && !state.flags?.knot2_done) desiredStage = "knot2";
    if (state.age === 50 && !state.flags?.knot3_done) desiredStage = "knot3";

    let pool = eligibleEvents({ kind: "major", story: "exclude", majorStage: desiredStage });

    // Fallbacks (in case of missing content or edge-case flags)
    if (!pool.length && desiredStage !== "major") pool = eligibleEvents({ kind: "major", story: "exclude" });
    if (!pool.length) pool = eligibleEvents({ kind: "general", story: "exclude" });
    if (!pool.length) pool = eligibleEvents({ story: "exclude" });

    const ev = pickEventFromPool(pool, avoid, eventDirectorWeight, false);
    if (!ev) {
      console.warn("No eligible events found for current age/filters.");
      return;
    }
    beginEvent(ev);
    return;
  }

  // ---------- Non-major beats ----------
  // 1) Forced storyline step if one is due (4–8 events after last step; never on majors).
  const due = pickDueStoryEvent();
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
  if (!pool.length) pool = eligibleEvents({ story: "exclude" }); // last resort

  const ev = pickEventFromPool(pool, avoid, eventDirectorWeight, false);
  if (!ev) {
    console.warn("No eligible events found for current age/filters.");
    return;
  }

  beginEvent(ev);
}

function beginEvent(ev) {
  selectedOutcomeIndex = null;
  committed = [];
  currentEvent = ev;

  drawHand(4);
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

function advanceTime() {
  // Count events completed (drives storyline pacing + condition timers).
  state.runEventIndex = (state.runEventIndex ?? 0) + 1;

  // Timers tick on completed events.
  tickConditionsAfterEvent();

  state.seasonIndex = 1 - state.seasonIndex;
  if (state.seasonIndex === 0) {
    state.age += 1;
    ensureFamilyState();
    // Age spouse + children annually.
    if (state.family.spouse) state.family.spouse.age = (state.family.spouse.age ?? 16) + 1;
    for (const h of (state.family.heirs ?? [])) h.age = (h.age ?? 0) + 1;
    log(`— A year passes. Age is now ${state.age}.`);
  }
}
function finishEvent() {
  // Advance time & start the next event.
  advanceTime();

  // Release resolve lock + re-enable top buttons.
  resolvingOutcome = false;
  btnNewEvent.disabled = false;
  btnDebugPickEvent.disabled = false;

  saveState();
  renderAll();
  loadRandomEvent();
}




// ---------- Resolve ----------
function resolveSelectedOutcome() {
  if (resolvingOutcome) return;
  if (selectedOutcomeIndex == null) return;

  resolvingOutcome = true;
  btnResolve.disabled = true;
  btnNewEvent.disabled = true;
  btnDebugPickEvent.disabled = true;

  const o = currentEvent.outcomes[selectedOutcomeIndex];

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
    postActions.push(...applyBundle(o.success));
    bundleForSummary = o.success;
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
        applyResourceDelta({ resource: d.resource, amount: half });
      }

      const softenedConds = [];
      for (const c of (o.fail?.conditions ?? [])) {
        const sev = (c.severity === "Severe") ? "Minor" : (c.severity ?? "Minor");
        softenedConds.push({ ...c, severity: sev });
        applyConditionChange({ ...c, severity: sev });
      }

      // Build a best-effort summary so the result modal matches what actually happened.
      const baseTxt = (o.fail?.text ?? '').trim() || (o.success?.text ?? '').trim();
      const partialTxt = baseTxt
        ? (baseTxt + "\n\nStill, you salvage what you can.")
        : "You don’t quite get what you wanted, but you salvage something.";
      bundleForSummary = { text: partialTxt, resources: halfResources, conditions: softenedConds };
    } else {
      postActions.push(...applyBundle(o.fail));
      bundleForSummary = o.fail;
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
      log(`💀 Death claims you at age ${state.age}.`);

      // Release the lock (succession is modal-driven).
      resolvingOutcome = false;
      btnNewEvent.disabled = false;
      btnDebugPickEvent.disabled = false;

      handleDeath();
      return;
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

  const narrative = (bundleForResult?.text ?? "").trim() || defaultResultNarrative(currentEvent, o, success, isPartial);
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
      runPostActionsSequentially(postActions, () => {
        if (wasMajor) {
          if (draftOpened) return;
          draftOpened = true;
          openDraftModal(() => finishEvent());
        } else {
          finishEvent();
        }
      });
    }
  });
}

// ---------- Succession ----------
function handleDeath() {
  ensureFamilyState();

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
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p>Your line has no named heir. The household scatters. The record ends here.</p>
      <p class="muted">Tip: pursue a match earlier, or survive long enough to see the first child come of age.</p>
    `;
    openModal("Bloodline Failure", wrap, {
      locked: false,
      onClose: () => {
        localStorage.removeItem(SAVE_KEY);
        state = null;
        logEl.textContent = "";
        showStart();
      }
    });
    return;
  }

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
    state.stats[state.heirFocus] = clamp((state.stats[state.heirFocus] ?? 0) + 1, 0, 5);
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
  showStart();
});

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

  startRunFromBuilder(bg, given, family);
});


btnResolve.addEventListener("click", () => resolveSelectedOutcome());
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

function traitById(id) {
  return TRAITS.find(t => t.id === id) || null;
}

function defaultStats() {
  return Object.fromEntries(STATS.map(s => [s, 0]));
}
function defaultRes() {
  return Object.fromEntries(RES.map(r => [r, 0]));
}

function computeFinalStats(bg) {
  const base = deepCopy(bg.startStats ?? bg.stats) ?? defaultStats();

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
}

function startRunFromBuilder(bg, givenName, familyName) {
  const deckIds = expandDeck(bg.deck);
  const validDeck = deckIds.filter(cid => DATA.cardsById[cid]);

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
    story: { due: {}, noStoryEvents: 0 },
    condMeta: { starveMisses: 0, wantedHeat: 0, woundedStrain: 0 },

    // IMPORTANT: no heir focus until you actually have an heir
    heirFocus: null,

    family: { spouse: null, prospect: null, heirs: [] },

    traits: Array.from(creation.traits),

    stats: finalStats,
    res: finalRes,
    conditions: startConds,

    flags: {},
    standings: {},
    masterDeck: [...validDeck],
    drawPile: shuffle([...validDeck]),
    discardPile: []
  };

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

  populateBackgroundSelect();

  if (loadState()) {
    state.flags ??= {};
    state.standings ??= {};
    state.runEventIndex ??= 0;
    state.story ??= { due: {}, noStoryEvents: 0 };
    state.story.due ??= {};
    if (!Number.isFinite(state.story.noStoryEvents)) state.story.noStoryEvents = 0;
    // Newer saves track spouse/children.
    state.family ??= { spouse: null, prospect: null, heirs: [] };
    state.family.heirs ??= [];

    showGame();
    logEl.textContent = "";
    log("Loaded saved run state.");
    loadRandomEvent();
  } else {
    showStart();
  }
}

boot();
