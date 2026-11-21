import { validateImport, balancesFor, planFor } from "./ledger.js";
import { validMainnetAddress } from "./address.js";

/* ---------- wallet (code-split) ----------
   wallet.js pulls in the signing stack, so it loads only on demand. It starts in a
   "sample" workspace that disables the connect button, so we switch it to "real"
   right after it loads. */
let _wallet,
  walletBound = false;
const loadWallet = () => (_wallet ??= import("./wallet.js"));
let _init;
const initWallet = () =>
  (_init ??= loadWallet().then((w) => {
    w.walletPanel();
    w.setWalletWorkspace("real");
    walletBound = true;
    return w;
  })).catch((error) => {
    _wallet = _init = undefined; // allow a retry after a network failure
    throw error;
  });

/* ---------- state: one real workspace ---------- */
const LEGACY_STORAGE_KEY = "tabcash:v1";
const STORAGE_KEY = "tabcash:v2:real";
const NS = "http://www.w3.org/2000/svg";
const PALETTE = ["#ffc766", "#ff8a6b", "#3be0a8", "#b8a1ff", "#6cc7ff", "#ff8fb1", "#e8d36a"];
const EMPTY_TAB = {
  version: 1,
  title: "My BCH tab",
  me: "p-you",
  people: [{ id: "p-you", name: "You", address: "", color: PALETTE[0] }],
  events: [],
};
let migratedLegacy = false;
let state = loadState();
let currentFilter = "all";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function migrateLegacy() {
  if (localStorage.getItem(STORAGE_KEY) !== null) return;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return;
  try {
    const value = JSON.parse(legacy);
    if (validateImport(value)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      migratedLegacy = true;
    }
  } catch {
    /* Keep unreadable legacy data untouched for recovery. */
  }
}
function loadState() {
  try {
    migrateLegacy();
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (validateImport(value)) return value;
  } catch {
    /* Fall through to an empty tab if saved data is unreadable. */
  }
  return structuredClone(EMPTY_TAB);
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- helpers ---------- */
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const satoshi = (value) => Math.round(Number(value) * 1e8);
const bch = (value, decimals = 8) => (value / 1e8).toFixed(decimals);
const shortBch = (value) => `${bch(value)} BCH`;
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);
const initials = (name) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
const signOf = (v) => (v > 0 ? "+" : v < 0 ? "\u2212" : "");

function colorOf(member, index = 0) {
  return /^#[0-9a-f]{6}$/i.test(member.color) ? member.color : PALETTE[index % PALETTE.length];
}
function person(pid) {
  return state.people.find((p) => p.id === pid) || { id: pid, name: "Former member", color: "#bdb7cf", address: "" };
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
function button(label, className, onclick) {
  const node = el("button", className, label);
  node.type = "button";
  if (onclick) node.addEventListener("click", onclick);
  return node;
}
// Avatar: solid color chip with dark or light initials, whichever reads better.
function avatar(member, small = false) {
  const color = colorOf(member, state.people.indexOf(member));
  const n = parseInt(color.slice(1), 16);
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const node = el("span", small ? "avatar sm" : "avatar", initials(member.name));
  node.style.background = color;
  node.style.color = lum > 0.18 ? "#1a0f1f" : "#fbf4ea";
  node.title = member.name;
  return node;
}
function dateGroup(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(date);
}
const fmtTime = (value) =>
  new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));

function showToast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 3600);
}
async function copy(text, message = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temp = el("textarea");
    temp.value = text;
    temp.style.cssText = "position:fixed;opacity:0";
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
  return `bitcoincash:${address.replace(/^bitcoincash:/, "")}?amount=${bch(amount)}`;
}
function emptyState(mark, title, body, action) {
  const empty = el("div", "empty-state");
  empty.append(el("div", "empty-mark", mark), el("b", "", title));
  if (body) empty.append(el("p", "", body));
  if (action) empty.append(action);
  return empty;
}

/* ---------- render ---------- */
function render() {
  const net = balancesFor(state);
  const myNet = net[state.me] || 0;
  const expenses = state.events.filter((event) => event.type === "expense");
  const total = sum(expenses, "amount");
  const plan = planFor(net);
  $("#group-title").textContent = state.title;
  $("#people-count").textContent = state.people.length;
  $("#total-spent").textContent = bch(total);
  $("#expense-count").textContent = expenses.length
    ? `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} recorded`
    : "No expenses yet";
  $("#owed-to-you").textContent = bch(Math.max(myNet, 0));
  $("#you-owe").textContent = bch(Math.max(-myNet, 0));
  const debtors = Object.values(net).filter((x) => x < 0).length;
  $("#owed-note").textContent = myNet > 0 ? `From ${debtors} ${debtors === 1 ? "person" : "people"}` : "Nothing owed to you";
  const status = $("#settlement-status");
  status.textContent = myNet === 0 ? "All clear" : myNet > 0 ? "\u25B2 You\u2019re owed" : "\u25BC You owe";
  status.dataset.tone = myNet === 0 ? "even" : myNet > 0 ? "pos" : "neg";
  $("#expense-filter-count").textContent = expenses.length;
  renderPeople(net);
  renderActivity();
  renderPlan(plan);
  renderInsights(net, plan, expenses, total);
}

function renderPeople(net) {
  const root = $("#people-list");
  root.replaceChildren();
  for (const member of state.people) {
    const row = el("div", "person-row");
    const text = button("", "person-edit");
    text.append(
      el("span", "person-name", member.name + (member.id === state.me && member.name !== "You" ? " \u00b7 you" : "")),
      el("span", "person-sub", member.address ? "Address saved \u00b7 edit" : "Add BCH address"),
    );
    text.addEventListener("click", () =>
      openField({
        title: `Address for ${member.name}`,
        label: "Mainnet Bitcoin Cash address",
        value: member.address || "",
        placeholder: "bitcoincash:q\u2026",
        optional: true,
        validate: (v) => (v && !validMainnetAddress(v) ? "Enter a valid full bitcoincash: address" : null),
        apply: (v) => {
          member.address = v;
          save();
          render();
          showToast("Address saved");
        },
      }),
    );
    const val = net[member.id] || 0;
    const tone = val > 0 ? "pos" : val < 0 ? "neg" : "";
    const balance = el("div", `person-balance ${tone}`);
    balance.append(
      el("span", "amt", `${signOf(val)}${bch(Math.abs(val), 4)}`),
      el("small", "", val > 0 ? "BCH \u00b7 owed" : val < 0 ? "BCH \u00b7 owes" : "BCH \u00b7 even"),
    );
    row.append(avatar(member), text, balance);
    root.append(row);
  }
  if (state.people.length < 2) {
    root.append(
      emptyState("\u263A", "Add people to your tab", "Add the friends you split costs with to start sharing expenses.", button("+ Add person", "btn btn-primary btn-sm", () => openPersonDialog())),
    );
  }
}

function renderActivity() {
  const root = $("#activity-list");
  root.replaceChildren();
  const shown = state.events
    .filter((event) => currentFilter === "all" || event.type === currentFilter)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  if (!shown.length) {
    if (currentFilter === "settlement") {
      root.append(emptyState("\u2197", "No settlements recorded", "Payments you record as confirmed will show up here."));
    } else if (state.people.length < 2) {
      root.append(emptyState("\u263A", "Add people to your tab", "Start by adding the people you share costs with.", button("+ Add person", "btn btn-primary", () => openPersonDialog())));
    } else {
      root.append(emptyState("+", "Add your first expense", "TabCash splits it in exact satoshis and works out who owes whom.", button("+ Add your first expense", "btn btn-primary", openExpenseDialog)));
    }
    return;
  }
  const groups = new Map();
  for (const event of shown) {
    const key = dateGroup(event.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  for (const [day, events] of groups) {
    root.append(el("div", "day-heading", day));
    for (const event of events) {
      const expense = event.type === "expense";
      const row = el("div", "activity-row");
      const icon = el("div", `activity-icon ${expense ? "" : "settlement"}`, expense ? "\u2198" : "\u2197");
      icon.setAttribute("aria-hidden", "true");
      const body = el("div");
      body.append(
        el("div", "activity-title", expense ? event.description : `${person(event.from).name} paid ${person(event.to).name}`),
        el(
          "div",
          "activity-meta",
          expense
            ? `Paid by ${person(event.payer).name} \u00b7 split ${event.split.length} ${event.split.length === 1 ? "way" : "ways"} \u00b7 ${fmtTime(event.at)}`
            : `Settlement \u00b7 ${fmtTime(event.at)}`,
        ),
      );
      const amount = el("div", `activity-amount ${expense ? "" : "paid-back"}`, `${expense ? "\u2212" : "+"}${bch(event.amount, 6)}`);
      amount.append(el("small", "", expense ? "shared expense" : "paid back"));
      row.append(icon, body, amount);
      root.append(row);
    }
  }
}

function renderPlan(plan) {
  const root = $("#settlement-list");
  root.replaceChildren();
  if (!plan.length) {
    root.append(
      state.events.length
        ? emptyState("\u2713", "Everyone is even", "Nothing left to pay back.")
        : emptyState("\u25CC", "No paybacks yet", "Suggested transfers appear after your first expense."),
    );
    return;
  }
  for (const item of plan.slice(0, 3)) {
    const row = button("", "settlement-item");
    row.title = "Copy a payment request for this transfer";
    row.append(
      avatar(person(item.from), true),
      el("span", "", person(item.from).name.split(" ")[0]),
      el("span", "settle-arrow", "\u2192"),
      avatar(person(item.to), true),
      el("span", "", person(item.to).name.split(" ")[0]),
      el("span", "settle-amount", bch(item.amount, 4)),
    );
    row.addEventListener("click", () => {
      const uri = paymentUri(item.to, item.amount);
      if (uri) copy(uri, "Payment request copied \u2014 review it in your wallet");
      else showToast(`${person(item.to).name} needs a BCH address first`);
    });
    root.append(row);
  }
  if (plan.length > 3) root.append(el("div", "settlement-more", `+ ${plan.length - 3} more in the full plan`));
}

/* ---------- insights (derived from events, never stored) ---------- */
function renderInsights(net, plan, expenses, total) {
  const none = !expenses.length;
  $("#insights-body").hidden = none;
  const empty = $("#insights-empty");
  empty.hidden = !none;
  empty.replaceChildren();
  if (none) {
    empty.append(emptyState("\u25D4", "Insights start with your first expense", "Totals, balances and the settlement flow appear here as your tab grows."));
    return;
  }
  const stats = $("#insight-stats");
  stats.replaceChildren();
  const settled = sum(state.events.filter((e) => e.type === "settlement"), "amount");
  const biggest = expenses.reduce((best, e) => (!best || e.amount > best.amount ? e : best), null);
  const paid = {};
  for (const e of expenses) paid[e.payer] = (paid[e.payer] || 0) + e.amount;
  const topPayer = Object.keys(paid).sort((a, b) => paid[b] - paid[a])[0];
  const average = Math.floor(total / state.people.length);
  const tiles = [
    ["Total spent", `${bch(total)} BCH`, `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`],
    ["Biggest expense", `${bch(biggest.amount)} BCH`, biggest.description],
    ["Average per person", `${bch(average)} BCH`, `Across ${state.people.length} ${state.people.length === 1 ? "person" : "people"}, rounded down`],
    ["Top payer", person(topPayer).name, `Fronted ${bch(paid[topPayer])} BCH`],
    ["Settled so far", `${bch(settled)} BCH`, "Recorded settlements only"],
    ["Paybacks left", String(plan.length), plan.length ? `${bch(sum(plan, "amount"))} BCH still to move` : "All even"],
  ];
  for (const [label, value, foot] of tiles) {
    const card = el("article", "glass stat");
    card.append(el("h3", "stat-label", label), el("p", "stat-value sm", value), el("p", "stat-foot", foot));
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
    const tone = val > 0 ? "pos" : val < 0 ? "neg" : "";
    const row = el("div", "bar-row");
    const track = el("div", "bar-track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${member.name} ${val > 0 ? "is owed" : val < 0 ? "owes" : "is even,"} ${bch(Math.abs(val))} BCH`);
    const fill = el("span", `bar-fill ${tone}`);
    fill.style.width = `${(Math.abs(val) / max) * 50}%`;
    track.append(fill);
    row.append(
      el("div", "bar-name", member.name),
      track,
      el("div", `bar-amount ${tone}`, `${signOf(val)}${bch(Math.abs(val), 6)}`),
    );
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
  const W = 560, xL = 150, xR = W - 150, mid = W / 2;
  const yOf = (list, pid) => 10 + list.indexOf(pid) * rowH + rowH / 2;
  const maxAmount = Math.max(...plan.map((p) => p.amount));
  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "flow-svg", role: "img", "aria-label": `${plan.length} suggested transfers` });
  chart.append(svg("title", {}, plan.map((p) => `${person(p.from).name} pays ${person(p.to).name} ${shortBch(p.amount)}`).join(". ")));
  plan.forEach((p, i) => {
    const y1 = yOf(payers, p.from), y2 = yOf(payees, p.to);
    const path = svg("path", {
      d: `M${xL} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${xR} ${y2}`,
      class: "flow-link",
      "stroke-width": String(3 + (p.amount / maxAmount) * 12),
    });
    path.style.setProperty("--i", i);
    const label = bch(p.amount, 4), pw = label.length * 8 + 18, cy = (y1 + y2) / 2;
    chart.append(
      path,
      svg("rect", { x: String(mid - pw / 2), y: String(cy - 12), width: String(pw), height: "22", rx: "11", class: "flow-pill" }),
      svg("text", { x: String(mid), y: String(cy + 4), class: "flow-label", "text-anchor": "middle" }, label),
    );
  });
  const node = (list, x, anchor, pid) => {
    const y = yOf(list, pid), m = person(pid);
    chart.append(
      svg("circle", { cx: String(x), cy: String(y), r: "7", fill: colorOf(m, state.people.indexOf(m)), class: "flow-dot" }),
      svg("text", { x: String(x + (anchor === "end" ? -16 : 16)), y: String(y + 4), class: "flow-name", "text-anchor": anchor }, m.name),
    );
  };
  payers.forEach((pid) => node(payers, xL, "end", pid));
  payees.forEach((pid) => node(payees, xR, "start", pid));
  const legend = el("div", "flow-legend");
  legend.append(el("span", "", "Pays \u2192"), el("span", "", "\u2192 Receives"));
  root.append(chart, legend);
}

/* ---------- dialogs ---------- */
function openExpenseDialog() {
  if (state.people.length < 2) {
    openPersonDialog("Add at least one person to split costs with.");
    return;
  }
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
    label.append(check, el("span", "", member.name));
    picker.append(label);
  }
  $("#expense-dialog").showModal();
}
function openPersonDialog(note = "") {
  $("#person-desc").textContent = note;
  $("#person-desc").hidden = !note;
  $("#person-dialog").showModal();
}
// One reusable single-field dialog for renaming the tab and editing addresses.
let fieldSubmit;
function openField({ title, label, value, placeholder = "", optional = false, validate, apply }) {
  $("#field-h").textContent = title;
  $("#field-label").textContent = label;
  const input = $("#field-input");
  input.value = value;
  input.placeholder = placeholder;
  input.required = !optional;
  $("#field-error").hidden = true;
  fieldSubmit = (raw) => {
    const v = raw.trim();
    const error = validate?.(v);
    if (error) return error;
    apply(v);
    return null;
  };
  $("#field-dialog").showModal();
  input.select();
}
function addPerson(name, address) {
  const cleanedName = name.trim();
  if (!cleanedName) return false;
  if (state.people.some((member) => member.name.toLowerCase() === cleanedName.toLowerCase())) {
    showToast("That name is already in the tab");
    return false;
  }
  const trimmed = address.trim();
  if (trimmed && !validMainnetAddress(trimmed)) {
    showToast("Enter a valid full bitcoincash: address, or leave it blank");
    return false;
  }
  state.people.push({ id: id("p"), name: cleanedName, address: trimmed, color: PALETTE[state.people.length % PALETTE.length] });
  save();
  render();
  showToast(`${cleanedName} added to the tab`);
  return true;
}

function openPlan() {
  const root = $("#plan-detail");
  root.replaceChildren();
  const plan = planFor(balancesFor(state));
  if (!plan.length) root.append(emptyState("\u2713", "Your tab is all settled", "Nothing left to pay back."));
  for (const item of plan) {
    const row = el("div", "plan-item");
    row.append(
      el("span", "arrow", "\u2197"),
      el("span", "who", `${person(item.from).name} pays ${person(item.to).name}`),
      el("span", "amount", shortBch(item.amount)),
    );
    const pending = (state.payments || []).find((p) => p.from === item.from && p.to === item.to && p.amount === item.amount);
    const pay = button(pending ? "Broadcast saved \u00b7 awaiting your confirmation" : "Pay with connected wallet", "btn btn-primary btn-sm");
    pay.disabled = Boolean(pending);
    pay.addEventListener("click", async () => {
      try {
        pay.disabled = true;
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
        state.payments.find((p) => p.txid === txid).status = "broadcast";
        save();
        row.append(txLink(txid, `Broadcast accepted \u00b7 view ${txid.slice(0, 12)}\u2026`));
        showToast("Broadcast accepted. Verify confirmation before recording payment.");
      } catch (e) {
        showToast(e.message);
        pay.disabled = false;
      }
    });
    const mark = button("Record confirmed payment manually", "btn btn-glass btn-sm", () => {
      if (!confirm(`Have you independently confirmed ${person(item.from).name}'s ${shortBch(item.amount)} payment to ${person(item.to).name}? This is your manual record; TabCash has not verified confirmation.`)) return;
      state.events.push({ id: id("s"), type: "settlement", from: item.from, to: item.to, amount: item.amount, at: new Date().toISOString() });
      save();
      render();
      $("#plan-dialog").close();
      showToast("Settlement recorded");
    });
    row.append(pay, mark);
    if (pending && /^[a-f0-9]{64}$/.test(pending.txid)) {
      row.append(txLink(pending.txid, `View pending transaction ${pending.txid.slice(0, 12)}\u2026`));
      const observation = el(
        "p",
        "payment-tx",
        pending.observation ? `${pending.observation.status} \u00b7 ${pending.observation.observedAt}` : "Status has not been queried. An interrupted broadcast may have an unknown outcome.",
      );
      observation.setAttribute("role", "status");
      const refresh = button("Read transaction status", "btn btn-glass btn-sm");
      refresh.onclick = async () => {
        refresh.disabled = true;
        try {
          pending.observation = await (await loadWallet()).readPaymentStatus(pending.txid);
          save();
          const o = pending.observation;
          observation.textContent = `${o.status}${o.confirmations !== null ? ` (${o.confirmations} confirmations)` : ""}. ${o.source}.`;
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
function txLink(txid, label) {
  const link = el("a", "payment-tx", label);
  link.href = `https://explorer.bitcoinunlimited.info/tx/${txid}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

/* ---------- events ---------- */
$("#add-expense").addEventListener("click", openExpenseDialog);
$("#add-person").addEventListener("click", () => openPersonDialog());
$("#settle-all").addEventListener("click", openPlan);
$("#copy-plan").addEventListener("click", () => {
  const plan = planFor(balancesFor(state));
  copy(
    plan.length ? plan.map((x) => `${person(x.from).name} \u2192 ${person(x.to).name}: ${shortBch(x.amount)}`).join("\n") : "Everyone is settled.",
    "Settlement plan copied",
  );
});
$("#edit-name").addEventListener("click", () =>
  openField({
    title: "Rename tab",
    label: "Tab name",
    value: state.title,
    validate: (v) => (v ? null : "Enter a name"),
    apply: (v) => {
      state.title = v.slice(0, 50);
      save();
      render();
    },
  }),
);
$("#field-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const error = fieldSubmit?.($("#field-input").value);
  if (error) {
    const node = $("#field-error");
    node.textContent = error;
    node.hidden = false;
    $("#field-input").focus();
    return;
  }
  $("#field-dialog").close();
});
$("#expense-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const amount = satoshi(form.get("amount"));
  const split = form.getAll("split");
  const description = String(form.get("description")).trim();
  if (!description || !Number.isSafeInteger(amount) || amount <= 0 || !split.length) {
    showToast("Add a description, an amount and at least one person");
    return;
  }
  state.events.push({ id: id("e"), type: "expense", description, amount, payer: String(form.get("payer")), split, at: new Date().toISOString() });
  save();
  render();
  event.currentTarget.reset();
  $("#expense-dialog").close();
  showToast("Expense added to the tab");
});
$("#person-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  if (!addPerson(String(data.get("name")), String(data.get("address")))) return;
  event.currentTarget.reset();
  $("#person-dialog").close();
});
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => document.getElementById(b.dataset.close).close()),
);
// A click on the dialog backdrop closes it.
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("mousedown", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  }),
);
document.querySelectorAll(".filter").forEach((b) =>
  b.addEventListener("click", () => {
    currentFilter = b.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => {
      item.classList.toggle("active", item === b);
      item.setAttribute("aria-pressed", String(item === b));
    });
    renderActivity();
  }),
);
$("#export-button").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  const anchor = el("a");
  anchor.href = url;
  anchor.download = `tabcash-${state.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Tab export saved");
});
$("#import-button").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const value = JSON.parse(await file.text());
    if (!validateImport(value)) throw new Error("The selected file is not a TabCash export.");
    if (state.events.length && !confirm("Importing replaces the tab currently open in this browser. Export it first if you want to keep it. Continue?")) return;
    delete value.workspaceMode; // field written by older versions; no longer used
    state = value;
    save();
    render();
    showToast("Tab imported");
  } catch (error) {
    showToast(error.message || "Could not read that tab");
  } finally {
    event.target.value = "";
  }
});

/* ---------- wallet connect + view gating ---------- */
const connectButton = $("#connect-wallet");
async function openWallet() {
  const triggers = document.querySelectorAll("#connect-wallet, [data-connect]");
  triggers.forEach((b) => b.setAttribute("aria-busy", "true"));
  try {
    await initWallet();
  } catch {
    showToast("Wallet failed to load. Check your connection and try again.");
    return;
  } finally {
    triggers.forEach((b) => b.removeAttribute("aria-busy"));
  }
  const dialog = $("#wallet-dialog");
  if (!dialog.open) dialog.showModal();
}
// Before wallet.js loads we own the button. Afterwards wallet.js's own onclick opens the dialog.
connectButton.addEventListener("click", () => {
  if (!walletBound) openWallet();
});
document.querySelectorAll("[data-connect]").forEach((b) => b.addEventListener("click", openWallet));

let view = "landing";
function setView(connected) {
  const next = connected ? "app" : "landing";
  connectButton.dataset.connected = String(connected);
  if (next === view) return;
  view = next;
  document.body.dataset.view = next;
  $("#landing").hidden = connected;
  $("#nav-landing").hidden = connected;
  $("#app").hidden = !connected;
  $("#nav-app").hidden = !connected;
  if (connected) {
    render();
    if (migratedLegacy) {
      showToast("Your saved tab from the previous version was preserved.");
      migratedLegacy = false;
    }
  } else {
    for (const dialog of document.querySelectorAll("dialog:not(#wallet-dialog)")) dialog.close();
  }
  window.scrollTo({ top: 0, behavior: "auto" });
  $("#main").focus({ preventScroll: true });
}
// wallet.js sets this label to "Wallet connected" when a wallet is ready and back to
// "Connect wallet" on disconnect. We only watch it; wallet.js stays untouched.
const syncView = () => setView(connectButton.textContent.trim() === "Wallet connected");
new MutationObserver(syncView).observe(connectButton, { childList: true, characterData: true, subtree: true });
syncView();

/* ---------- motion: gentle hero parallax ---------- */
const hero = $(".hero");
let frame = 0;
hero.addEventListener("pointermove", (event) => {
  if (reducedMotion.matches || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--px", ((event.clientX - r.left) / r.width - 0.5).toFixed(3));
    hero.style.setProperty("--py", ((event.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
});
hero.addEventListener("pointerleave", () => {
  hero.style.setProperty("--px", 0);
  hero.style.setProperty("--py", 0);
});
