import { validateSubmission } from "./submission-validation.js";
import { validateImport, balancesFor, planFor } from "./ledger.js";
import { validMainnetAddress } from "./address.js";
// wallet.js pulls in the signing stack; load it on demand.
let _wallet, walletBound = false;
const loadWallet = () => (_wallet ??= import("./wallet.js"));
const initWallet = async () => {
  const w = await loadWallet();
  if (!walletBound) {
    walletBound = true;
    w.walletPanel();
    w.setWalletWorkspace(mode);
  }
  return w;
};
import { submission } from "./submission.js";

const LEGACY_STORAGE_KEY = "tabcash:v1";
const SAMPLE_STORAGE_KEY = "tabcash:v2:sample";
const REAL_STORAGE_KEY = "tabcash:v2:real";
const GUIDE_KEY = "tabcash:guide-dismissed";
const NS = "http://www.w3.org/2000/svg";

const DEMO = {
  version: 1,
  title: "Weekend in Austin",
  me: "p-jordan",
  people: [
    { id: "p-jordan", name: "Jordan Lee", address: "", color: "#9ccf65" },
    { id: "p-maya", name: "Maya Chen", address: "", color: "#df9d72" },
    { id: "p-theo", name: "Theo James", address: "", color: "#83aeda" },
    { id: "p-noor", name: "Noor Patel", address: "", color: "#c39be8" },
  ],
  events: [
    { id: "e-1", type: "expense", description: "Dinner at Lazarus Brewing", amount: 1200000, payer: "p-jordan", split: ["p-jordan", "p-maya", "p-theo", "p-noor"], at: "2026-11-18T20:32:00.000Z" },
    { id: "e-2", type: "expense", description: "Ride to the trailhead", amount: 400000, payer: "p-maya", split: ["p-jordan", "p-maya", "p-theo"], at: "2026-11-18T16:05:00.000Z" },
    { id: "e-3", type: "expense", description: "Groceries and coffee", amount: 800000, payer: "p-noor", split: ["p-jordan", "p-maya", "p-theo", "p-noor"], at: "2026-11-17T18:12:00.000Z" },
    { id: "e-4", type: "expense", description: "Snacks for the drive", amount: 100000, payer: "p-theo", split: ["p-theo", "p-jordan", "p-maya"], at: "2026-11-17T10:44:00.000Z" },
  ],
};
const EMPTY_REAL_TAB = {
  version: 1,
  title: "My BCH tab",
  me: "p-you",
  people: [{ id: "p-you", name: "You", address: "", color: "#9ccf65" }],
  events: [],
};
const palette = ["#9ccf65", "#df9d72", "#83aeda", "#c39be8", "#6fd1bc", "#e08db0", "#d3bd69"];

let migratedLegacyData = false;
let mode = initialMode();
let state = loadState(mode);
let currentFilter = "all";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function initialMode() {
  if (localStorage.getItem(REAL_STORAGE_KEY) === null) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      try {
        const value = JSON.parse(legacy);
        if (validateImport(value)) {
          localStorage.setItem(REAL_STORAGE_KEY, JSON.stringify(value));
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          migratedLegacyData = true;
          return "real";
        }
      } catch {
        /* Keep unreadable legacy data untouched for recovery. */
      }
    }
  }
  // Every page load lands in My tab; the stored mode no longer picks the initial workspace.
  return "real";
}
function loadState(workspaceMode) {
  try {
    const key = workspaceMode === "sample" ? SAMPLE_STORAGE_KEY : REAL_STORAGE_KEY;
    const value = JSON.parse(localStorage.getItem(key));
    if (validateImport(value)) return value;
  } catch {
    /* Start with the mode's safe default if saved data is unreadable. */
  }
  return structuredClone(workspaceMode === "sample" ? DEMO : EMPTY_REAL_TAB);
}
function save() {
  const key = mode === "sample" ? SAMPLE_STORAGE_KEY : REAL_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(state));
}
function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function person(pid) {
  return (
    state.people.find((p) => p.id === pid) || { id: pid, name: "Former member", color: "#859187", address: "" }
  );
}
function satoshi(value) {
  return Math.round(Number(value) * 1e8);
}
function bch(value, decimals = 8) {
  return (value / 1e8).toFixed(decimals);
}
function shortBch(value) {
  return `${bch(value, 8)} BCH`;
}
function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}
function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}
function balances() {
  return balancesFor(state);
}
function planFrom(net = balances()) {
  return planFor(net);
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}
function tint(node, color) {
  node.style.background = `${color}22`;
  node.style.color = color;
}
function dateGroup(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "TODAY";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" })
    .format(date)
    .toUpperCase();
}
function fmtTime(value) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function showToast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2800);
}
async function copy(text, message = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temp = el("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.append(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }
  showToast(message);
}
function paymentUri(receiver, amount) {
  const address = person(receiver).address.trim();
  if (!validMainnetAddress(address)) return null;
  return `bitcoincash:${address.replace(/^bitcoincash:/, "")}?amount=${bch(amount, 8)}`;
}
function emptyState(mark, title, body) {
  const empty = el("div", "empty-state");
  empty.append(el("div", "empty-mark", mark), el("b", "", title));
  if (body) empty.append(el("p", "", body));
  return empty;
}

/* ---------- render ---------- */
function render() {
  const net = balances();
  const myNet = net[state.me] || 0;
  const expenses = state.events.filter((event) => event.type === "expense");
  const total = sum(expenses, "amount");
  const plan = planFrom(net);
  $("#group-title").textContent = state.title;
  $("#people-count").textContent = state.people.length;
  $("#total-spent").textContent = bch(total);
  $("#expense-count").textContent = `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} recorded`;
  $("#owed-to-you").textContent = bch(Math.max(myNet, 0));
  $("#you-owe").textContent = bch(Math.max(-myNet, 0));
  $("#owed-note").textContent =
    myNet > 0 ? `Across ${Object.values(net).filter((x) => x < 0).length} people` : "Nothing owed yet";
  const status = $("#settlement-status");
  status.textContent = myNet === 0 ? "ALL CLEAR" : myNet > 0 ? "YOU\u2019RE OWED" : "YOU OWE";
  status.dataset.tone = myNet === 0 ? "even" : myNet > 0 ? "pos" : "neg";
  $("#expense-filter-count").textContent = expenses.length;
  renderHero(total, expenses.length, plan, net);
  renderPeople(net);
  renderActivity();
  renderPlan(plan);
  renderInsights(net, plan, expenses, total);
}
function renderHero(total, count, plan, net) {
  $("#hero-title").textContent = state.title;
  $("#hero-total").textContent = bch(total);
  $("#hero-sub").textContent = `${count} ${count === 1 ? "expense" : "expenses"} \u00b7 ${state.people.length} ${state.people.length === 1 ? "person" : "people"}`;
  $("#hero-transfers").textContent = plan.length;
  const debtors = Object.values(net).filter((x) => x < 0).length;
  $("#hero-naive").textContent = plan.length
    ? `Balances are netted into ${plan.length} payback${plan.length === 1 ? "" : "s"} for ${debtors} ${debtors === 1 ? "debtor" : "debtors"}.`
    : "Nothing to pay back right now.";
  const root = $("#hero-avatars");
  root.replaceChildren();
  for (const member of state.people.slice(0, 6)) {
    const a = el("span", "avatar", initials(member.name));
    a.title = member.name;
    tint(a, member.color);
    root.append(a);
  }
}
function renderPeople(net) {
  const root = $("#people-list");
  root.replaceChildren();
  for (const member of state.people) {
    const row = el("div", "person-row");
    const avatar = el("span", "avatar", initials(member.name));
    tint(avatar, member.color);
    const text = el("button", "person-edit");
    text.type = "button";
    text.append(
      el("span", "person-name", member.name + (member.id === state.me && member.name !== "You" ? " \u00b7 you" : "")),
      el("span", "person-sub", member.address ? "Address saved \u00b7 click to edit" : "Click to add BCH address"),
    );
    text.onclick = () => {
      const value = prompt(`Mainnet BCH address for ${member.name}`, member.address || "");
      if (value === null) return;
      if (value && !validMainnetAddress(value.trim())) {
        showToast("Enter a valid full bitcoincash: address");
        return;
      }
      member.address = value.trim();
      save();
      render();
    };
    const val = net[member.id] || 0;
    const balance = el("div", `person-balance ${val > 0 ? "pos" : val < 0 ? "neg" : ""}`, `${val > 0 ? "+" : val < 0 ? "\u2212" : ""}${bch(Math.abs(val), 4)}`);
    balance.append(el("small", "", "BCH"));
    row.append(avatar, text, balance);
    root.append(row);
  }
}
function renderActivity() {
  const root = $("#activity-list");
  root.replaceChildren();
  const shown = state.events
    .filter((event) => currentFilter === "all" || event.type === currentFilter)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  if (!shown.length) {
    const settlements = currentFilter === "settlement";
    root.append(
      emptyState(
        settlements ? "\u2197" : "+",
        settlements ? "No settlements recorded" : mode === "real" ? "Add your first shared expense" : "No expenses yet",
        settlements
          ? "Settlements you mark complete will show up here."
          : "Add your first shared expense and TabCash will split it in exact satoshis.",
      ),
    );
    if (currentFilter !== "settlement" && mode === "real") {
      const cta = el("button", "btn btn-primary", "+ Add your first shared expense");
      cta.type = "button";
      cta.onclick = () => $("#add-expense").click();
      root.firstChild.append(cta);
    }
    return;
  }
  const groups = new Map();
  shown.forEach((event) => {
    const key = dateGroup(event.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });
  for (const [day, events] of groups) {
    root.append(el("div", "day-heading", day));
    for (const event of events) {
      const row = el("div", "activity-row");
      const icon = el("div", `activity-icon ${event.type === "settlement" ? "settlement" : ""}`, event.type === "settlement" ? "\u2197" : "\u2198");
      const body = el("div");
      const title = event.type === "expense" ? event.description : `${person(event.from).name} paid ${person(event.to).name}`;
      body.append(el("div", "activity-title", title));
      body.append(
        el(
          "div",
          "activity-meta",
          event.type === "expense"
            ? `Paid by ${person(event.payer).name} \u00b7 ${event.split.length} people \u00b7 ${fmtTime(event.at)}`
            : `Settlement \u00b7 ${fmtTime(event.at)}`,
        ),
      );
      const amount = el("div", `activity-amount${event.type === "settlement" ? " paid-back" : ""}`, event.type === "expense" ? `\u2212${bch(event.amount, 6)}` : bch(event.amount, 6));
      amount.append(el("small", "", event.type === "expense" ? "shared expense" : "paid back"));
      row.append(icon, body, amount);
      root.append(row);
    }
  }
}
function renderPlan(plan) {
  const root = $("#settlement-list");
  root.replaceChildren();
  if (!plan.length) {
    root.append(emptyState("\u2713", "Everyone is even", "Nice work. Nothing left to pay back."));
    return;
  }
  for (const item of plan.slice(0, 3)) {
    const row = el("button", "settlement-item");
    row.type = "button";
    row.title = "Copy a payment request for this transfer";
    const from = el("span", "avatar sm", initials(person(item.from).name));
    tint(from, person(item.from).color);
    const to = el("span", "avatar sm", initials(person(item.to).name));
    tint(to, person(item.to).color);
    row.append(
      from,
      el("span", "", person(item.from).name.split(" ")[0]),
      el("span", "settle-arrow", "\u2192"),
      to,
      el("span", "", person(item.to).name.split(" ")[0]),
      el("span", "settle-amount", bch(item.amount, 4)),
    );
    row.addEventListener("click", () => requestPayment(item));
    root.append(row);
  }
  if (plan.length > 3) root.append(el("div", "settlement-more", `+ ${plan.length - 3} more transfers in the full plan`));
}
function requestPayment(item) {
  if (mode !== "real") {
    showToast("Payment requests are available in My tab, not in the sample demo.");
    return;
  }
  const uri = paymentUri(item.to, item.amount);
  if (uri) copy(uri, "Payment request copied \u2014 review it in your wallet");
  else showToast(`${person(item.to).name} needs to add a BCH address first`);
}

/* ---------- insights (presentation-only, derived from events) ---------- */
function renderInsights(net, plan, expenses, total) {
  const stats = $("#insight-stats");
  stats.replaceChildren();
  const settled = sum(state.events.filter((e) => e.type === "settlement"), "amount");
  const biggest = expenses.reduce((best, e) => (!best || e.amount > best.amount ? e : best), null);
  const paid = {};
  for (const e of expenses) paid[e.payer] = (paid[e.payer] || 0) + e.amount;
  const topPayerId = Object.keys(paid).sort((a, b) => paid[b] - paid[a])[0];
  const average = state.people.length ? Math.floor(total / state.people.length) : 0;
  const tiles = [
    ["TOTAL SPENT", `${bch(total)} BCH`, `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`],
    ["BIGGEST EXPENSE", biggest ? `${bch(biggest.amount)} BCH` : "\u2014", biggest ? biggest.description : "Add an expense to see this"],
    ["AVERAGE PER PERSON", `${bch(average)} BCH`, `Across ${state.people.length} ${state.people.length === 1 ? "person" : "people"} (rounded down)`],
    ["TOP PAYER", topPayerId ? person(topPayerId).name : "\u2014", topPayerId ? `Fronted ${bch(paid[topPayerId])} BCH` : "No one has paid yet"],
    ["SETTLED SO FAR", `${bch(settled)} BCH`, "Recorded settlements only"],
    ["PAYBACKS LEFT", String(plan.length), plan.length ? `${bch(sum(plan, "amount"))} BCH still to move` : "All even"],
  ];
  for (const [label, value, foot] of tiles) {
    const card = el("article", "card stat reveal in");
    card.append(el("div", "stat-label", label), el("div", "stat-value sm", value), el("div", "stat-foot", foot));
    stats.append(card);
  }
  renderBars(net);
  renderFlow(plan);
}
function renderBars(net) {
  const root = $("#balance-bars");
  root.replaceChildren();
  const max = Math.max(1, ...Object.values(net).map((v) => Math.abs(v)));
  for (const member of state.people) {
    const val = net[member.id] || 0;
    const row = el("div", "bar-row");
    const name = el("div", "bar-name", member.name);
    const track = el("div", "bar-track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${member.name}: ${val > 0 ? "is owed" : val < 0 ? "owes" : "is even,"} ${bch(Math.abs(val))} BCH`);
    const fill = el("span", `bar-fill ${val > 0 ? "pos" : val < 0 ? "neg" : ""}`);
    fill.style.width = `${(Math.abs(val) / max) * 50}%`;
    track.append(fill);
    const amount = el("div", `bar-amount ${val > 0 ? "pos" : val < 0 ? "neg" : ""}`, `${val > 0 ? "+" : val < 0 ? "\u2212" : ""}${bch(Math.abs(val), 6)}`);
    row.append(name, track, amount);
    root.append(row);
  }
}
function renderFlow(plan) {
  const root = $("#flow");
  root.replaceChildren();
  if (!plan.length) {
    root.append(emptyState("\u2713", "Nothing to settle", "When someone owes the group, the payback flow appears here."));
    return;
  }
  const payers = [...new Set(plan.map((p) => p.from))];
  const payees = [...new Set(plan.map((p) => p.to))];
  const rowH = 54;
  const H = Math.max(payers.length, payees.length) * rowH + 20;
  const W = 560;
  const xL = 150;
  const xR = W - 150;
  const yOf = (list, pid) => 10 + list.indexOf(pid) * rowH + rowH / 2;
  const maxAmount = Math.max(...plan.map((p) => p.amount));
  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "flow-svg", role: "img", "aria-label": `${plan.length} suggested transfers` });
  const desc = svg("title", {}, plan.map((p) => `${person(p.from).name} pays ${person(p.to).name} ${shortBch(p.amount)}`).join(". "));
  chart.append(desc);
  plan.forEach((p, i) => {
    const y1 = yOf(payers, p.from);
    const y2 = yOf(payees, p.to);
    const mid = (xL + xR) / 2;
    const path = svg("path", {
      d: `M${xL} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${xR} ${y2}`,
      class: "flow-link",
      "stroke-width": String(3 + (p.amount / maxAmount) * 12),
    });
    path.style.setProperty("--i", i);
    chart.append(path);
    const label = svg("text", { x: String(mid), y: String((y1 + y2) / 2 - 8), class: "flow-label", "text-anchor": "middle" }, bch(p.amount, 4));
    chart.append(label);
  });
  const node = (list, x, anchor, pid) => {
    const y = yOf(list, pid);
    const m = person(pid);
    chart.append(svg("circle", { cx: String(x), cy: String(y), r: "7", fill: m.color, class: `flow-dot ${list === payers ? "pay" : "recv"}` }));
    const dx = anchor === "end" ? -16 : 16;
    chart.append(svg("text", { x: String(x + dx), y: String(y + 4), class: "flow-name", "text-anchor": anchor }, m.name));
  };
  payers.forEach((pid) => node(payers, xL, "end", pid));
  payees.forEach((pid) => node(payees, xR, "start", pid));
  const legend = el("div", "flow-legend");
  legend.append(el("span", "", "Pays \u2192"), el("span", "", "\u2192 Receives"));
  root.append(chart, legend);
}

/* ---------- workspace mode ---------- */
function renderMode() {
  const isSample = mode === "sample";
  document.body.dataset.workspaceMode = mode;
  $("#sample-mode").setAttribute("aria-pressed", String(isSample));
  $("#real-mode").setAttribute("aria-pressed", String(!isSample));
  $("#hero-mode-label").textContent = isSample ? "SAMPLE DEMO" : "MY TAB";
  const notice = $("#mode-notice");
  notice.classList.toggle("sample-mode", isSample);
  notice.classList.toggle("real-mode", !isSample);
  notice.replaceChildren(
    el("b", "mode-label", isSample ? "SAMPLE DEMO" : "MY TAB"),
    el(
      "span",
      "mode-description",
      isSample
        ? "Sample demo never sends BCH. Fictional Austin expenses; editing stays in this sample, and wallet payments and settlement records are disabled."
        : "My tab uses real BCH mainnet. Your tab is saved only in this browser, and wallet payments send real BCH after you confirm them in your wallet.",
    ),
  );
  if (migratedLegacyData && !isSample) {
    notice.append(el("span", "migration-note", "Your saved tab from the previous version was preserved here."));
  }
  $("#copy-plan-label").textContent = isSample ? "Copy sample plan" : "Copy plan";
  $("#export-button").textContent = isSample ? "Export sample data" : "Export this tab";
  const importButton = $("#import-button");
  importButton.disabled = isSample;
  importButton.title = isSample ? "Switch to My tab before importing a personal tab." : "Import a TabCash export into My tab.";
  $("#plan-dialog .modal-desc").textContent = isSample
    ? "This is sample data. Wallet payments and settlement records are disabled in the sample demo."
    : "Pay through your connected wallet, or record a confirmed payment manually. Broadcasts are pending until mined; balances change only when you record payment.";
  syncConnectButton();
}
function syncConnectButton() {
  if (walletBound) return void _wallet.then((w) => w.setWalletWorkspace(mode));
  const button = $("#connect-wallet");
  const sample = mode !== "real";
  button.disabled = sample;
  button.textContent = sample ? "Wallet \u00b7 My tab only" : "Connect wallet";
  button.title = sample ? "Switch to My tab before connecting a wallet." : "Connect a WizardConnect HD wallet on BCH mainnet.";
  button.setAttribute("aria-label", sample ? "Wallet connection is available only in My tab" : button.textContent);
}
function switchMode(nextMode) {
  if (nextMode === mode) return;
  mode = nextMode === "real" ? "real" : "sample";
  state = loadState(mode);
  currentFilter = "all";
  document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
  render();
  renderMode();
  showToast(mode === "sample" ? "Sample demo opened" : "My tab opened");
}

/* ---------- forms ---------- */
function renderExpenseForm() {
  const payer = $("#payer-select");
  payer.replaceChildren();
  for (const member of state.people) {
    const option = el("option", "", member.name);
    option.value = member.id;
    payer.append(option);
  }
  payer.value = state.me;
  const picker = $("#split-picker");
  picker.replaceChildren();
  for (const member of state.people) {
    const label = el("label", "split-chip");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.name = "split";
    check.value = member.id;
    check.checked = true;
    label.append(check, el("span", "", `${initials(member.name)} ${member.name}`));
    picker.append(label);
  }
}
function addPerson(name, address) {
  const cleanedName = name.trim();
  if (!cleanedName) return;
  if (state.people.some((member) => member.name.toLowerCase() === cleanedName.toLowerCase())) {
    showToast("That name is already in the tab");
    return;
  }
  state.people.push({ id: id("p"), name: cleanedName, address: address.trim(), color: palette[state.people.length % palette.length] });
  save();
  render();
  showToast(`${cleanedName} added to the tab`);
}
function openPlan() {
  const root = $("#plan-detail");
  root.replaceChildren();
  const plan = planFrom();
  if (!plan.length) root.append(emptyState("\u2713", "Your tab is all settled."));
  for (const item of plan) {
    const row = el("div", "plan-item");
    row.append(el("span", "arrow", "\u2197"), el("span", "", `${person(item.from).name} pays ${person(item.to).name}`), el("span", "amount", shortBch(item.amount)));
    const sampleMode = mode === "sample";
    const pay = el("button", "btn btn-primary btn-sm", sampleMode ? "Switch to My tab to pay" : "Pay with connected wallet");
    pay.type = "button";
    pay.disabled = sampleMode;
    if (sampleMode) pay.title = "Wallet payments are disabled in the sample demo.";
    pay.addEventListener("click", async () => {
      if (mode !== "real") {
        showToast("Switch to My tab before sending real BCH.");
        return;
      }
      try {
        pay.disabled = true;
        const already = (state.payments || []).find((p) => p.from === item.from && p.to === item.to && p.amount === item.amount);
        if (already) throw Error(`A payment was already broadcast: ${already.txid}. Check it before sending again.`);
        const txid = await (await initWallet()).payMainnet({
          to: person(item.to).address,
          amount: item.amount,
          prompt: `TabCash: ${person(item.from).name} pays ${person(item.to).name} for ${state.title}`,
          onSigned: (signedId) => {
            state.payments ??= [];
            state.payments.push({ ...item, txid: signedId, at: new Date().toISOString(), status: "broadcast-outcome-pending" });
            save();
          },
        });
        const saved = state.payments.find((p) => p.txid === txid);
        saved.status = "broadcast";
        save();
        const link = el("a", "payment-tx", `Broadcast accepted \u00b7 view ${txid.slice(0, 12)}\u2026`);
        link.href = `https://explorer.bitcoinunlimited.info/tx/${txid}`;
        link.target = "_blank";
        link.rel = "noopener";
        row.append(link);
        showToast("Broadcast accepted. Verify confirmation before recording payment.");
      } catch (e) {
        showToast(e.message);
        pay.disabled = false;
      }
    });
    row.append(pay);
    const mark = el("button", "btn btn-ghost btn-sm", sampleMode ? "Settlement records disabled in sample mode" : "Record confirmed payment manually");
    mark.type = "button";
    mark.disabled = sampleMode;
    if (sampleMode) mark.title = "Sample settlements are never recorded as real payments.";
    mark.addEventListener("click", () => {
      if (mode !== "real") {
        showToast("Switch to My tab before recording a settlement.");
        return;
      }
      if (
        !confirm(
          `Have you independently confirmed ${person(item.from).name}'s ${shortBch(item.amount)} payment to ${person(item.to).name}? This is your manual record; TabCash has not verified confirmation.`,
        )
      )
        return;
      state.events.push({ id: id("s"), type: "settlement", from: item.from, to: item.to, amount: item.amount, at: new Date().toISOString() });
      save();
      render();
      $("#plan-dialog").close();
      showToast("Settlement recorded");
    });
    row.append(mark);
    const pending = (state.payments || []).find((p) => p.from === item.from && p.to === item.to && p.amount === item.amount);
    if (pending && /^[a-f0-9]{64}$/.test(pending.txid)) {
      pay.disabled = true;
      pay.textContent = "Broadcast saved \u00b7 awaiting manual confirmation";
      const link = el("a", "payment-tx", `View pending transaction ${pending.txid.slice(0, 12)}\u2026`);
      link.href = `https://explorer.bitcoinunlimited.info/tx/${pending.txid}`;
      link.target = "_blank";
      link.rel = "noopener";
      row.append(link);
      const refresh = el("button", "btn btn-ghost btn-sm", "Read transaction status");
      refresh.type = "button";
      const observation = el(
        "p",
        "payment-tx",
        pending.observation
          ? `${pending.observation.status} \u00b7 ${pending.observation.observedAt}`
          : "Status has not been queried. An interrupted broadcast may have an unknown outcome.",
      );
      observation.setAttribute("role", "status");
      observation.setAttribute("aria-live", "polite");
      refresh.onclick = async () => {
        refresh.disabled = true;
        try {
          pending.observation = await (await loadWallet()).readPaymentStatus(pending.txid);
          save();
          observation.textContent = `${pending.observation.status}${pending.observation.confirmations !== null ? " (" + pending.observation.confirmations + " confirmations)" : ""}. ${pending.observation.source}.`;
        } catch (e) {
          observation.textContent = e.message;
        } finally {
          refresh.disabled = false;
        }
      };
      row.append(refresh, observation);
    }
    root.append(row);
  }
  $("#plan-dialog").showModal();
}

/* ---------- events ---------- */
$("#add-expense").addEventListener("click", () => {
  renderExpenseForm();
  $("#expense-dialog").showModal();
});
$("#add-person").addEventListener("click", () => $("#person-dialog").showModal());
$("#settle-all").addEventListener("click", openPlan);
$("#copy-plan").addEventListener("click", () => {
  const plan = planFrom();
  const text = plan.length
    ? plan.map((x) => `${person(x.from).name} \u2192 ${person(x.to).name}: ${shortBch(x.amount)}`).join("\n")
    : "Everyone is settled.";
  copy(text, "Settlement plan copied");
});
$("#edit-name").addEventListener("click", () => {
  const title = prompt("Name this shared tab", state.title);
  if (title?.trim()) {
    state.title = title.trim().slice(0, 50);
    save();
    render();
  }
});
$("#expense-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const amount = satoshi(form.get("amount"));
  const split = form.getAll("split");
  if (!Number.isSafeInteger(amount) || amount <= 0 || !split.length) {
    showToast("Enter an amount and choose at least one person");
    return;
  }
  state.events.push({
    id: id("e"),
    type: "expense",
    description: String(form.get("description")).trim(),
    amount,
    payer: String(form.get("payer")),
    split,
    at: new Date().toISOString(),
  });
  save();
  render();
  event.currentTarget.reset();
  $("#expense-dialog").close();
  showToast("Expense added to the tab");
});
$("#person-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  addPerson(String(data.get("name")), String(data.get("address")));
  event.currentTarget.reset();
  $("#person-dialog").close();
});
document.querySelectorAll("[data-close]").forEach((button) =>
  button.addEventListener("click", () => document.getElementById(button.dataset.close).close()),
);
// Click on the dialog backdrop closes it.
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("mousedown", (event) => {
    const r = dialog.getBoundingClientRect();
    const outside = event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    if (event.target === dialog && outside) dialog.close();
  }),
);
document.querySelectorAll(".filter").forEach((button) =>
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
    renderActivity();
  }),
);
$("#export-button").addEventListener("click", () => {
  const exported = { ...state, workspaceMode: mode };
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a");
  anchor.href = url;
  const prefix = mode === "sample" ? "tabcash-sample" : "tabcash";
  anchor.download = `${prefix}-${state.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Tab export saved");
});
$("#import-button").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (mode !== "real") throw new Error("Switch to My tab before importing personal data.");
    const value = JSON.parse(await file.text());
    if (!validateImport(value)) throw new Error("The selected file is not a TabCash export.");
    if (value.workspaceMode === "sample") throw new Error("Sample demo exports cannot be imported into My tab.");
    const { workspaceMode: _workspaceMode, ...importedState } = value;
    state = importedState;
    save();
    render();
    showToast("Tab imported");
  } catch (error) {
    showToast(error.message || "Could not read that tab");
  }
  event.target.value = "";
});
$("#sample-mode").addEventListener("click", () => switchMode("sample"));
$("#real-mode").addEventListener("click", () => switchMode("real"));

/* ---------- submission section (honest: blanks stay pending) ---------- */
function renderSubmission() {
  const report = validateSubmission(submission);
  const list = $("#submission-links");
  list.replaceChildren();
  for (const check of report.checks) {
    const item = el("li", `sub-item ${check.valid ? "ok" : "pending"}`);
    item.append(el("span", "sub-state", check.valid ? "FORMAT OK" : "PENDING"));
    const isAddress = check.key === "ember2026DonationAddress";
    if (check.valid && !isAddress) {
      const a = el("a", "", `${check.label} \u2197`);
      a.href = check.value;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      item.append(a);
    } else if (check.valid) {
      item.append(el("span", "", `${check.label}: `), el("code", "donation-address", check.value));
    } else {
      item.append(el("span", "", `${check.label}: ${check.requirement}`));
    }
    list.append(item);
  }
  const passing = report.checks.filter((c) => c.valid).length;
  $("#submission-notice").textContent = `${passing}/${report.checks.length} public submission fields pass local format checks. ${report.notice}`;
}

/* ---------- getting started ---------- */
function setupGuide() {
  const guide = $("#getting-started");
  guide.open = localStorage.getItem(GUIDE_KEY) !== "yes";
  guide.querySelectorAll("[data-guide-action]").forEach((button) => {
    button.onclick = () => {
      switchMode("real");
      $(button.dataset.guideAction === "first-expense" ? "#add-expense" : "#settle-all").click();
    };
  });
  $("#dismiss-guide").onclick = () => {
    guide.open = false;
    localStorage.setItem(GUIDE_KEY, "yes");
    guide.querySelector("summary").focus();
  };
}

/* ---------- motion: scroll reveal + hero parallax ---------- */
function setupMotion() {
  const targets = document.querySelectorAll(".reveal:not(.in)");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    targets.forEach((node) => node.classList.add("in"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    targets.forEach((node) => observer.observe(node));
  }
  // Gentle pointer parallax: one CSS-variable write per frame, transform-only consumers.
  const stage = $(".hero");
  let frame = 0;
  stage.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = stage.getBoundingClientRect();
      stage.style.setProperty("--px", ((event.clientX - r.left) / r.width - 0.5).toFixed(3));
      stage.style.setProperty("--py", ((event.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  });
  stage.addEventListener("pointerleave", () => {
    stage.style.setProperty("--px", 0);
    stage.style.setProperty("--py", 0);
  });
}

render();
renderMode();
$("#connect-wallet").addEventListener("click", async (event) => {
  if (walletBound) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await initWallet();
  } catch (e) {
    syncConnectButton();
    showToast("Wallet failed to load. Check your connection and try again.");
    return;
  }
  if (mode === "real") $("#wallet-dialog").showModal();
});
/* Sample/My tab switcher stays hidden until a wallet connects. wallet.js is untouched; we watch its button label. */
function setupModeSwitcher() {
  const button = $("#connect-wallet");
  const switcher = $(".mode-switch");
  let connected = false;
  const sync = () => {
    const label = button.textContent.trim();
    // wallet.js labels: "Wallet connected" (connected, My tab), "Connect wallet" (disconnected),
    // "Wallet \u00b7 My tab only" (Sample open). The last carries no news, so keep the last known state.
    if (label === "Wallet connected") connected = true;
    else if (label === "Connect wallet") connected = false;
    switcher.hidden = !connected;
    if (!connected && mode !== "real") switchMode("real");
  };
  new MutationObserver(sync).observe(button, { childList: true, characterData: true, subtree: true });
  sync();
}
$("#hero-connect").addEventListener("click", () => {
  switchMode("real");
  $("#connect-wallet").click();
});
$("#hero-start").addEventListener("click", () => {
  switchMode("real");
  $("#app").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
  $("#add-expense").click();
});
setupModeSwitcher();
renderSubmission();
setupGuide();
setupMotion();
