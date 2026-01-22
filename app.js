/* Heirloom Web Prototype v0.1 (Data-driven)
   - Loads: ./data/cards.json, ./data/events.json, ./data/backgrounds.json
   - Supports: requirements → disabled outcomes with reasons
   - Card levels: uses level 1 by default (upgrade-ready later)
*/

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

const MAJOR_AGES = new Set([20,25,30,35,40,45,50]);
const SEASONS = ["Vernal", "Autumnal"];

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
const heirFocusSelect = document.getElementById("heirFocusSelect");
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");
const btnResolve = document.getElementById("btnResolve");
const btnNewEvent = document.getElementById("btnNewEvent");
const btnDebugPickEvent = document.getElementById("btnDebugPickEvent");

const statusLine = document.getElementById("statusLine");
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

// Modal
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const btnModalClose = document.getElementById("btnModalClose");

// ---------- State ----------
let state = null;
let currentEvent = null;
let selectedOutcomeIndex = null;
let hand = [];
let committed = [];

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
  if (age <= 29) return 1;
  if (age <= 39) return 3;
  if (age <= 44) return 6;
  if (age <= 49) return 10;
  return 18;
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

  // Minimal validation (helps catch typos early)
  for (const bg of DATA.backgrounds) {
    const deckIds = expandDeck(bg.deck);
    for (const cid of deckIds) {
      if (!DATA.cardsById[cid]) console.warn(`Background ${bg.id} references missing cardId: ${cid}`);
    }
  }
  for (const ev of DATA.events) {
    if (!ev.outcomes || ev.outcomes.length !== 4) {
      console.warn(`Event ${ev.id} should have exactly 4 outcomes (has ${ev.outcomes?.length ?? 0}).`);
    }
  }
}

// ---------- Requirements ----------
function tierIndex(tier) {
  const i = TIERS.indexOf(tier);
  return i >= 0 ? i : 2; // default Neutral
}

function hasCondition(id, severity = "Any") {
  const found = state.conditions.find(c => c.id === id);
  if (!found) return false;
  if (severity === "Any") return true;
  return found.severity === severity;
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
  list.className = "hand"; // re-use existing layout style
  wrap.appendChild(list);

  for (const cid of choices) {
    const c = DATA.cardsById[cid];
    const lvlData = getCardLevelData(c);

    const btn = document.createElement("button");
    btn.className = "cardbtn";
    btn.type = "button";
    btn.innerHTML = `
      <div class="cardname">${c.name}</div>
      <div class="cardmeta">
        <span class="badge">${c.discipline}</span>
        <span class="badge">Contexts: ${(c.contexts ?? []).join(", ")}</span>
        <span class="badge">+${lvlData.bonus}%</span>
        <span class="badge">${c.rarity}</span>
      </div>
      <div class="muted">Click to choose</div>
    `;

    btn.addEventListener("click", () => {
      state.discardPile.push(cid);
      log(`Draft reward chosen: ${c.name}.`);
      modalLocked = false;
      closeModal();
      onPicked?.();
    });

    list.appendChild(btn);
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
      for (let i = 0; i < count; i++) out.push(entry.cardId);
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
      if (state.drawPile.length === 0) break;
    }
    hand.push(state.drawPile.pop());
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
  return `${c.name} (+${lvlData.bonus}%)`;
}

// ---------- Effects ----------
function ensureStateMaps() {
  state.flags ??= {};      // { flagId: remainingEvents }
  state.standings ??= {};  // { factionId: tier }
}

function applyResourceDelta(d) {
  if (!d) return;
  const k = d.resource;
  const amt = d.amount ?? 0;
  state.res[k] = clamp((state.res[k] ?? 0) + amt, 0, 99);
}

function findConditionIndex(id) {
  return state.conditions.findIndex(c => c.id === id);
}

function addCondition(id, severity) {
  const idx = findConditionIndex(id);
  if (idx === -1) state.conditions.push({ id, severity });
  else {
    const cur = state.conditions[idx].severity;
    if (cur === "Minor" && severity === "Severe") state.conditions[idx].severity = "Severe";
  }
}

function removeCondition(id) {
  state.conditions = state.conditions.filter(c => c.id !== id);
}

function downgradeCondition(id) {
  const idx = findConditionIndex(id);
  if (idx === -1) return;
  if (state.conditions[idx].severity === "Severe") state.conditions[idx].severity = "Minor";
  else removeCondition(id);
}

function applyConditionChange(ch) {
  if (!ch) return;
  const id = ch.id;
  const mode = ch.mode;
  const sev = ch.severity ?? "Minor";
  if (mode === "Add") addCondition(id, sev);
  else if (mode === "Remove") removeCondition(id);
  else if (mode === "Downgrade") downgradeCondition(id);
  else if (mode === "Upgrade") addCondition(id, "Severe");
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
  if (!bundle) return;
  for (const d of (bundle.resources ?? [])) applyResourceDelta(d);
  for (const c of (bundle.conditions ?? [])) applyConditionChange(c);
  for (const f of (bundle.flags ?? [])) applyFlagChange(f);
  for (const s of (bundle.standings ?? [])) applyStandingDelta(s);
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

function openModal(title, bodyEl, opts = {}) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.appendChild(bodyEl);

  modalLocked = Boolean(opts.locked);
  btnModalClose.style.display = modalLocked ? "none" : "";

  modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  if (modalLocked) return;
  modalBackdrop.classList.add("hidden");
  modalLocked = false;
  btnModalClose.style.display = "";
}

function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

// ---------- Rendering ----------
function isMajorEventNow() {
  const season = SEASONS[state.seasonIndex];
  return (season === "Vernal" && MAJOR_AGES.has(state.age));
}

function renderStatus() {
  const season = SEASONS[state.seasonIndex];
  statusLine.textContent = `Age ${state.age} • ${season} • Heirs ${state.heirCount ?? 0}`;

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
  eventMeta.textContent = `Context: ${currentEvent.context}`;
  eventPrompt.textContent = currentEvent.prompt;
}

function renderOutcomes() {
  outcomesEl.innerHTML = "";
  currentEvent.outcomes.forEach((o, idx) => {
    const reasons = unmetReasons(o.requirements);
    const disabled = reasons.length > 0;

    const div = document.createElement("div");
    div.className = "outcome"
      + (selectedOutcomeIndex === idx ? " selected" : "")
      + (disabled ? " disabled" : "");

    div.innerHTML = `
      <div class="outcome-title">${o.title}</div>
      <div class="muted">${o.desc ?? ""}</div>
      <div class="outcome-meta">
        <span class="badge">Stat: ${o.stat}</span>
        <span class="badge">Diff: ${o.diff}</span>
        <span class="badge">Allows: ${(o.allowed ?? []).join(", ")}</span>
        ${(o.tags?.length ? `<span class="badge">Tags: ${o.tags.join(", ")}</span>` : ``)}
      </div>
      ${disabled ? `<div class="muted">Locked: ${reasons.join(" • ")}</div>` : ``}
    `;

    div.addEventListener("click", () => {
      if (disabled) return;
      selectedOutcomeIndex = idx;
      committed = committed.filter(cid => isCardUsable(cid, idx));
      renderAll();
    });

    outcomesEl.appendChild(div);
  });
}

function renderHand() {
  slot1.textContent = committed[0] ? cardLabel(committed[0]) : "—";
  slot1.classList.toggle("muted", !committed[0]);
  slot2.textContent = committed[1] ? cardLabel(committed[1]) : "—";
  slot2.classList.toggle("muted", !committed[1]);

  if (selectedOutcomeIndex == null) {
    handHint.textContent = "Pick an outcome to see which cards are playable.";
  } else {
    handHint.textContent = "Tap a playable card to commit/uncommit (max 2).";
  }

  handEl.innerHTML = "";
  for (const cid of hand) {
    const c = DATA.cardsById[cid];
    if (!c) continue;
    const usable = (selectedOutcomeIndex != null) ? isCardUsable(cid, selectedOutcomeIndex) : false;
    const isCommitted = committed.includes(cid);

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
        <span class="badge">+${lvlData.bonus}%</span>
        ${extra ? `<span class="badge">${extra}</span>` : ``}
      </div>
      ${selectedOutcomeIndex != null && !usable ? `<div class="muted">Not usable for this outcome.</div>` : ``}
    `;

    div.addEventListener("click", () => {
      if (selectedOutcomeIndex == null) return;
      if (!usable) return;

      if (isCommitted) committed = committed.filter(x => x !== cid);
      else {
        if (committed.length >= 2) return;
        committed.push(cid);
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

  const cardBonus = committed.reduce((sum, cid) => {
    const c = DATA.cardsById[cid];
    if (!c) return sum;
    return sum + (getCardLevelData(c).bonus ?? 0);
  }, 0);

  let chance = 50 + (statVal * 8) + cardBonus - (diff * 10);
  chance = clamp(chance, 5, 95);

  const cls = (chance >= 60) ? "good" : (chance <= 35) ? "bad" : "";
  chanceLine.innerHTML = `Success chance: <span class="${cls}">${chance}%</span>`;
  chanceBreakdown.textContent =
    `50 + (${o.stat} ${statVal}×8=${statVal*8}) + cards ${cardBonus} − (diff ${diff}×10=${diff*10})`;
}

function renderAll() {
  renderStatus();
  renderEvent();
  renderOutcomes();
  renderHand();
  renderChance();
}

// ---------- Event selection ----------
function eligibleEvents() {
  return DATA.events.filter(e => state.age >= (e.minAge ?? 18) && state.age <= (e.maxAge ?? 50));
}

function loadRandomEvent() {
  const eligible = eligibleEvents();
  currentEvent = pick(eligible);
  beginEvent(currentEvent);
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
    b.addEventListener("click", () => { closeModal(); beginEvent(ev); });
    list.appendChild(b);
  }

  wrap.appendChild(list);
  openModal("Debug: Pick Event", wrap);
}

// ---------- Time ----------
function advanceTime() {
  state.seasonIndex = 1 - state.seasonIndex;
  if (state.seasonIndex === 0) {
    state.age += 1;
    log(`— A year passes. Age is now ${state.age}.`);
  }
}

// ---------- Resolve ----------
function resolveSelectedOutcome() {
  if (selectedOutcomeIndex == null) return;

  const o = currentEvent.outcomes[selectedOutcomeIndex];
  const wasMajor = isMajorEventNow();
  const reasons = unmetReasons(o.requirements);
  if (reasons.length) return; // safety

  const statVal = state.stats[o.stat] ?? 0;
  const diff = o.diff ?? 3;

  const cardBonus = committed.reduce((sum, cid) => {
    const c = DATA.cardsById[cid];
    if (!c) return sum;
    return sum + (getCardLevelData(c).bonus ?? 0);
  }, 0);

  let chance = 50 + (statVal * 8) + cardBonus - (diff * 10);
  chance = clamp(chance, 5, 95);

  const roll = rInt(1, 100);
  const success = roll <= chance;

  // Discard committed cards
  for (const cid of committed) state.discardPile.push(cid);

  // Move all uncommitted hand cards to discard (so the deck loop works)
  for (const cid of hand) {
     if (!committed.includes(cid)) state.discardPile.push(cid);
     }
  hand = [];


  // Mortality tracking
  const severeBefore = state.conditions.filter(c => c.severity === "Severe").length;

  if (success) {
    applyBundle(o.success);
    log(`SUCCESS (${roll} ≤ ${chance}) → ${o.title}`);
  } else {
    const partial = committed.some(cid => {
      const c = DATA.cardsById[cid];
      return c ? Boolean(getCardLevelData(c).partialOnFail) : false;
    });

    if (partial) {
      log(`FAIL (${roll} > ${chance}) but PARTIAL triggers → ${o.title}`);

      // Partial rule (simple): half of success resources (toward 0), plus failure conditions downgraded to Minor.
      for (const d of (o.success?.resources ?? [])) {
        applyResourceDelta({ resource: d.resource, amount: Math.trunc((d.amount ?? 0) / 2) });
      }
      for (const c of (o.fail?.conditions ?? [])) {
        const sev = (c.severity === "Severe") ? "Minor" : (c.severity ?? "Minor");
        applyConditionChange({ ...c, severity: sev });
      }
    } else {
      applyBundle(o.fail);
      log(`FAIL (${roll} > ${chance}) → ${o.title}`);
    }
  }

  // Mortality triggers
  const severeAfter = state.conditions.filter(c => c.severity === "Severe").length;
  const gainedSevere = severeAfter > severeBefore;
  const hadSevereAlready = severeBefore > 0;

  const perilous = (o.tags ?? []).includes("Perilous");
  const majorNow = isMajorEventNow();

  let mortalityTriggered = false;
  if (majorNow) mortalityTriggered = true;
  if (!success && perilous && gainedSevere) mortalityTriggered = true;
  if (gainedSevere && hadSevereAlready) mortalityTriggered = true;

  if (mortalityTriggered) {
    const mChance = computeMortalityChance();
    const mRoll = rInt(1, 100);
    log(`Mortality Check: ${mChance}% (roll ${mRoll})`);
    if (mRoll <= mChance) {
      log(`💀 Death claims you at age ${state.age}.`);
      handleDeath();
      return;
    }
  }

  

  // Advance and cleanup
  tickFlags();
committed = [];
selectedOutcomeIndex = null;

if (wasMajor) {
  saveState();
  renderAll();

  openDraftModal(() => {
    advanceTime();
    saveState();
    renderAll();
    loadRandomEvent();
  });

  return;
}

// normal flow (non-major)
advanceTime();
saveState();
renderAll();
loadRandomEvent();

  advanceTime();

  committed = [];
  selectedOutcomeIndex = null;

  saveState();
  renderAll();
  loadRandomEvent();
}

// ---------- Succession ----------
function handleDeath() {
  state.heirCount = (state.heirCount ?? 0) + 1;

  state.res.Coin = Math.floor((state.res.Coin ?? 0) * 0.7);
  state.res.Supplies = Math.floor((state.res.Supplies ?? 0) * 0.7);
  state.res.Renown = Math.floor((state.res.Renown ?? 0) * 0.8);
  state.res.Influence = Math.floor((state.res.Influence ?? 0) * 0.8);
  state.res.Secrets = Math.floor((state.res.Secrets ?? 0) * 0.8);

  // Clear Minors; Severe becomes Minor
  state.conditions = state.conditions
    .filter(c => c.severity === "Severe")
    .map(c => ({ id: c.id, severity: "Minor" }));

  state.age = 18;
  state.seasonIndex = 0;

  // Heir focus gives +1 stat (cap 5)
  const focus = state.heirFocus;
  state.stats[focus] = clamp((state.stats[focus] ?? 0) + 1, 0, 5);

  // Refresh deck: shuffle everything back
  state.drawPile = shuffle([...state.drawPile, ...state.discardPile, ...hand]);
  state.discardPile = [];
  hand = [];
  committed = [];
  selectedOutcomeIndex = null;

  log(`Heir takes over. Focus bonus: +1 ${focus}. Heirs so far: ${state.heirCount}.`);
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
  const focus = heirFocusSelect.value;
  startRun(bg, focus);
});

btnResolve.addEventListener("click", () => resolveSelectedOutcome());
btnNewEvent.addEventListener("click", () => loadRandomEvent());
btnDebugPickEvent.addEventListener("click", () => openEventPickerModal());
btnModalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });

// ---------- Start / Load ----------
function populateBackgroundSelect() {
  bgSelect.innerHTML = "";
  for (const bg of DATA.backgrounds) {
    const opt = document.createElement("option");
    opt.value = bg.id;
    opt.textContent = bg.name;
    bgSelect.appendChild(opt);
  }
}

function showLoadingUI(isLoading) {
  btnStart.disabled = isLoading;
  btnNewEvent.disabled = isLoading;
  btnResolve.disabled = true;
  if (isLoading) {
    logEl.textContent = "Loading data...\n";
  }
}

function startRun(bg, heirFocusStat) {
  if (!bg) return;

  const deckIds = expandDeck(bg.deck);
  const validDeck = deckIds.filter(cid => DATA.cardsById[cid]);

  state = {
    age: 18,
    seasonIndex: 0,
    heirCount: 0,
    heirFocus: heirFocusStat,
    stats: deepCopy(bg.startStats),
    res: deepCopy(bg.startRes),
    conditions: [],
    flags: {},
    standings: {},
    drawPile: shuffle([...validDeck]),
    discardPile: []
  };

  saveState();
  logEl.textContent = "";
  log(`Run begins as ${bg.name}. Heir focus: ${heirFocusStat}.`);
  showGame();
  loadRandomEvent();
}

async function boot() {
  showLoadingUI(true);

  try {
    await loadAllData();
  } catch (e) {
    showLoadingUI(false);
    logEl.textContent = `ERROR: ${e.message}\n\nMake sure you're running a local server and the /data files exist.`;
    showStart();
    return;
  }

  populateBackgroundSelect();
  showLoadingUI(false);

  if (loadState()) {
    // Ensure maps exist (older saves)
    state.flags ??= {};
    state.standings ??= {};
    showGame();
    logEl.textContent = "";
    log("Loaded saved run state.");
    loadRandomEvent();
  } else {
    showStart();
  }
}

boot();
