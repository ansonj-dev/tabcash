import { validateSubmission } from "./submission-validation.js";
import { validateImport, balancesFor, planFor } from "./ledger.js";
import {
  walletPanel,
  payMainnet,
  readPaymentStatus,
  validMainnetAddress,
} from "./wallet.js";
import { submission } from "./submission.js";
const STORAGE_KEY = "tabcash:v1";
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
    {
      id: "e-1",
      type: "expense",
      description: "Dinner at Lazarus Brewing",
      amount: 1200000,
      payer: "p-jordan",
      split: ["p-jordan", "p-maya", "p-theo", "p-noor"],
      at: "2026-11-18T20:32:00.000Z",
    },
    {
      id: "e-2",
      type: "expense",
      description: "Ride to the trailhead",
      amount: 400000,
      payer: "p-maya",
      split: ["p-jordan", "p-maya", "p-theo"],
      at: "2026-11-18T16:05:00.000Z",
    },
    {
      id: "e-3",
      type: "expense",
      description: "Groceries and coffee",
      amount: 800000,
      payer: "p-noor",
      split: ["p-jordan", "p-maya", "p-theo", "p-noor"],
      at: "2026-11-17T18:12:00.000Z",
    },
    {
      id: "e-4",
      type: "expense",
      description: "Snacks for the drive",
      amount: 100000,
      payer: "p-theo",
      split: ["p-theo", "p-jordan", "p-maya"],
      at: "2026-11-17T10:44:00.000Z",
    },
  ],
};
const palette = [
  "#9ccf65",
  "#df9d72",
  "#83aeda",
  "#c39be8",
  "#6fd1bc",
  "#e08db0",
  "#d3bd69",
];
let state = loadState();
let currentFilter = "all";
let toastTimer;

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (validateImport(value)) return value;
  } catch {
    /* Start with the sample tab if saved data is unreadable. */
  }
  return structuredClone(DEMO);
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function person(pid) {
  return (
    state.people.find((p) => p.id === pid) || {
      id: pid,
      name: "Former member",
      color: "#859187",
      address: "",
    }
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
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}
function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}
function balances() { return balancesFor(state); }
function planFrom(net = balances()) { return planFor(net); }
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function getEventShare(event, pid) {
  const members = [...new Set(event.split)];
  const index = members.indexOf(pid);
  if (index < 0) return 0;
  const share = Math.floor(event.amount / members.length);
  return share + (index < event.amount - share * members.length ? 1 : 0);
}
function dateGroup(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "TODAY";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
    .format(date)
    .toUpperCase();
}
function fmtTime(value) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function showToast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2400);
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
function render() {
  const net = balances();
  const myNet = net[state.me] || 0;
  const expenses = state.events.filter((event) => event.type === "expense");
  document.querySelector("#group-title").textContent = state.title;
  document.querySelector("#crumb-name").textContent = state.title;
  document.querySelector("#me-avatar").textContent = initials(
    person(state.me).name,
  ).slice(0, 1);
  document.querySelector("#you-mini").textContent = initials(
    person(state.me).name,
  ).slice(0, 1);
  document.querySelector("#people-count").textContent = state.people.length;
  document.querySelector("#tab-count").textContent = "1";
  document.querySelector("#total-spent").textContent = bch(
    sum(expenses, "amount"),
  );
  document.querySelector("#expense-count").textContent =
    `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} recorded`;
  document.querySelector("#owed-to-you").textContent = bch(Math.max(myNet, 0));
  document.querySelector("#you-owe").textContent = bch(Math.max(-myNet, 0));
  document.querySelector("#owed-note").textContent =
    myNet > 0
      ? `Across ${Object.values(net).filter((x) => x < 0).length} people`
      : "Nothing owed yet";
  document.querySelector("#settlement-status").textContent =
    myNet === 0 ? "ALL CLEAR" : myNet > 0 ? "YOU’RE OWED" : "YOU OWE";
  document.querySelector("#expense-filter-count").textContent = expenses.length;
  renderPeople(net);
  renderActivity();
  renderPlan(net);
}
function renderPeople(net) {
  const root = document.querySelector("#people-list");
  root.replaceChildren();
  for (const member of state.people) {
    const row = el("div", "person-row");
    const avatar = el("span", "person-avatar", initials(member.name));
    avatar.style.background = `${member.color}22`;
    avatar.style.color = member.color;
    const text = el("div");
    text.append(
      el(
        "div",
        "person-name",
        member.name + (member.id === state.me ? " · you" : ""),
      ),
    );
    const val = net[member.id] || 0;
    text.append(
      el(
        "div",
        "person-sub",
        member.address
          ? "Address saved · click to edit"
          : "Click to add BCH address",
      ),
    );
    text.tabIndex = 0;
    text.setAttribute("role", "button");
    text.style.cursor = "pointer";
    const edit = () => {
      const value = prompt(
        `Mainnet BCH address for ${member.name}`,
        member.address || "",
      );
      if (value === null) return;
      if (value && !validMainnetAddress(value.trim())) {
        showToast("Enter a valid full bitcoincash: address");
        return;
      }
      member.address = value.trim();
      save();
      render();
    };
    text.onclick = edit;
    text.onkeydown = (e) => {
      if (e.key === "Enter") edit();
    };
    const balance = el(
      "div",
      "person-balance",
      `${val > 0 ? "+" : val < 0 ? "−" : ""}${bch(Math.abs(val), 4)}`,
    );
    balance.style.color =
      val > 0 ? "var(--lime)" : val < 0 ? "#e7ad83" : "#9aa69c";
    balance.append(el("small", "", "BCH"));
    row.append(avatar, text, balance);
    root.append(row);
  }
}
function renderActivity() {
  const root = document.querySelector("#activity-list");
  root.replaceChildren();
  const shown = state.events
    .filter((event) => currentFilter === "all" || event.type === currentFilter)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  if (!shown.length) {
    const empty = el("div", "empty-state");
    empty.append(
      el("div", "empty-mark", currentFilter === "settlement" ? "↗" : "＋"),
    );
    empty.append(
      el(
        "b",
        "",
        currentFilter === "settlement"
          ? "No settlements recorded"
          : "The first round is on you",
      ),
    );
    empty.append(
      el(
        "p",
        "",
        currentFilter === "settlement"
          ? "Settlements you mark complete will show up here."
          : "Add an expense and TabCash will split it evenly for your group.",
      ),
    );
    root.append(empty);
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
      const icon = el(
        "div",
        `activity-icon ${event.type === "settlement" ? "settlement" : ""}`,
        event.type === "settlement" ? "↗" : "↘",
      );
      const body = el("div");
      const title =
        event.type === "expense"
          ? event.description
          : `${person(event.from).name} paid ${person(event.to).name}`;
      body.append(el("div", "activity-title", title));
      const meta =
        event.type === "expense"
          ? `Paid by ${person(event.payer).name} · ${event.split.length} people · ${fmtTime(event.at)}`
          : `Settlement · ${fmtTime(event.at)}`;
      body.append(el("div", "activity-meta", meta));
      const amount = el(
        "div",
        "activity-amount",
        event.type === "expense"
          ? `−${bch(event.amount, 6)}`
          : `${bch(event.amount, 6)}`,
      );
      amount.append(
        el(
          "small",
          "",
          event.type === "expense" ? "shared expense" : "paid back",
        ),
      );
      row.append(icon, body, amount);
      root.append(row);
    }
  }
}
function renderPlan(net = balances()) {
  const root = document.querySelector("#settlement-list");
  root.replaceChildren();
  const plan = planFrom(net);
  if (!plan.length) {
    root.append(el("div", "settlement-item", "Everyone is even. Nice work."));
    return;
  }
  for (const item of plan.slice(0, 3)) {
    const row = el("div", "settlement-item");
    const from = el("span", "settle-avatar", initials(person(item.from).name));
    from.style.background = `${person(item.from).color}22`;
    from.style.color = person(item.from).color;
    const to = el("span", "settle-avatar", initials(person(item.to).name));
    to.style.background = `${person(item.to).color}22`;
    to.style.color = person(item.to).color;
    const names = el("span", "", `${person(item.from).name.split(" ")[0]}`);
    row.append(
      from,
      names,
      el("span", "settle-arrow", "→"),
      to,
      el("span", "", person(item.to).name.split(" ")[0]),
      el("span", "settle-amount", `${bch(item.amount, 4)}`),
    );
    row.addEventListener("click", () => requestPayment(item));
    root.append(row);
  }
  if (plan.length > 3)
    root.append(
      el(
        "div",
        "settlement-item",
        `+ ${plan.length - 3} more transfers in the full plan`,
      ),
    );
}
function requestPayment(item) {
  const uri = paymentUri(item.to, item.amount);
  if (uri) copy(uri, "Payment request copied — review it in your wallet");
  else showToast(`${person(item.to).name} needs to add a BCH address first`);
}
function renderExpenseForm() {
  const payer = document.querySelector("#payer-select");
  payer.replaceChildren();
  for (const member of state.people) {
    const option = el("option", "", member.name);
    option.value = member.id;
    payer.append(option);
  }
  payer.value = state.me;
  const picker = document.querySelector("#split-picker");
  picker.replaceChildren();
  for (const member of state.people) {
    const label = el("label", "split-chip");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.name = "split";
    check.value = member.id;
    check.checked = true;
    label.append(
      check,
      el("span", "", `${initials(member.name)} ${member.name}`),
    );
    picker.append(label);
  }
}
function addPerson(name, address) {
  const cleanedName = name.trim();
  if (!cleanedName) return;
  if (
    state.people.some(
      (member) => member.name.toLowerCase() === cleanedName.toLowerCase(),
    )
  ) {
    showToast("That name is already in the tab");
    return;
  }
  state.people.push({
    id: id("p"),
    name: cleanedName,
    address: address.trim(),
    color: palette[state.people.length % palette.length],
  });
  save();
  render();
  showToast(`${cleanedName} added to the tab`);
}
document.querySelector("#add-expense").addEventListener("click", () => {
  renderExpenseForm();
  document.querySelector("#expense-dialog").showModal();
});
document
  .querySelector("#add-person")
  .addEventListener("click", () =>
    document.querySelector("#person-dialog").showModal(),
  );
document.querySelector("#settle-all").addEventListener("click", () => {
  const root = document.querySelector("#plan-detail");
  root.replaceChildren();
  const plan = planFrom();
  if (!plan.length)
    root.append(el("div", "empty-state", "Your tab is all settled."));
  for (const item of plan) {
    const row = el("div", "plan-item");
    row.append(
      el("span", "arrow", "↗"),
      el("span", "", `${person(item.from).name} pays ${person(item.to).name}`),
      el("span", "amount", shortBch(item.amount)),
    );
    const pay = el("button", "outline-button", "Pay with connected wallet");
    pay.style.gridColumn = "2 / 4";
    pay.addEventListener("click", async () => {
      try {
        pay.disabled = true;
        const pending = (state.payments || []).find(
          (p) =>
            p.from === item.from &&
            p.to === item.to &&
            p.amount === item.amount,
        );
        if (pending)
          throw Error(
            `A payment was already broadcast: ${pending.txid}. Check it before sending again.`,
          );
        const txid = await payMainnet({
          to: person(item.to).address,
          amount: item.amount,
          prompt: `TabCash: ${person(item.from).name} pays ${person(item.to).name} for ${state.title}`,
          onSigned: (signedId) => {
            state.payments ??= [];
            state.payments.push({
              ...item,
              txid: signedId,
              at: new Date().toISOString(),
              status: "broadcast-outcome-pending",
            });
            save();
          },
        });
        const saved = state.payments.find((p) => p.txid === txid);
        saved.status = "broadcast";
        save();
        const link = el(
          "a",
          "payment-tx",
          `Broadcast accepted · view ${txid.slice(0, 12)}…`,
        );
        link.href = `https://explorer.bitcoinunlimited.info/tx/${txid}`;
        link.target = "_blank";
        link.rel = "noopener";
        row.append(link);
        showToast(
          "Broadcast accepted. Verify confirmation before recording payment.",
        );
      } catch (e) {
        showToast(e.message);
        pay.disabled = false;
      }
    });
    row.append(pay);
    const mark = el(
      "button",
      "outline-button",
      "Record confirmed payment manually",
    );
    mark.style.gridColumn = "2 / 4";
    mark.style.marginTop = "0";
    mark.addEventListener("click", () => {
      if (
        !confirm(
          `Have you independently confirmed ${person(item.from).name}'s ${shortBch(item.amount)} payment to ${person(item.to).name}? This is your manual record; TabCash has not verified confirmation.`,
        )
      )
        return;
      state.events.push({
        id: id("s"),
        type: "settlement",
        from: item.from,
        to: item.to,
        amount: item.amount,
        at: new Date().toISOString(),
      });
      save();
      render();
      document.querySelector("#plan-dialog").close();
      showToast("Settlement recorded");
    });
    row.append(mark);
    const pending = (state.payments || []).find(
      (p) =>
        p.from === item.from && p.to === item.to && p.amount === item.amount,
    );
    if (pending && /^[a-f0-9]{64}$/.test(pending.txid)) {
      pay.disabled = true;
      pay.textContent = "Broadcast saved · awaiting manual confirmation";
      const link = el(
        "a",
        "payment-tx",
        `View pending transaction ${pending.txid.slice(0, 12)}…`,
      );
      link.href = `https://explorer.bitcoinunlimited.info/tx/${pending.txid}`;
      link.target = "_blank";
      link.rel = "noopener";
      row.append(link);
    }
    if (pending && /^[a-f0-9]{64}$/.test(pending.txid)) {
      const refresh = el("button", "outline-button", "Read transaction status");
      refresh.style.gridColumn = "2 / 4";
      const observation = el(
        "p",
        "payment-tx",
        pending.observation
          ? `${pending.observation.status} · ${pending.observation.observedAt}`
          : "Status has not been queried. An interrupted broadcast may have an unknown outcome.",
      );
      observation.setAttribute("role", "status");
      observation.setAttribute("aria-live", "polite");
      refresh.onclick = async () => {
        refresh.disabled = true;
        try {
          pending.observation = await readPaymentStatus(pending.txid);
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
  document.querySelector("#plan-dialog").showModal();
});
document.querySelector("#copy-plan").addEventListener("click", () => {
  const plan = planFrom();
  const text = plan.length
    ? plan
        .map(
          (x) =>
            `${person(x.from).name} → ${person(x.to).name}: ${shortBch(x.amount)}`,
        )
        .join("\n")
    : "Everyone is settled.";
  copy(text, "Settlement plan copied");
});
document.querySelector("#edit-name").addEventListener("click", () => {
  const title = prompt("Name this shared tab", state.title);
  if (title?.trim()) {
    state.title = title.trim().slice(0, 50);
    save();
    render();
  }
});
document.querySelector("#expense-form").addEventListener("submit", (event) => {
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
  document.querySelector("#expense-dialog").close();
  showToast("Expense added to the tab");
});
document.querySelector("#person-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  addPerson(String(data.get("name")), String(data.get("address")));
  event.currentTarget.reset();
  document.querySelector("#person-dialog").close();
});
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      document.getElementById(button.dataset.close).close(),
    ),
  );
document.querySelectorAll(".filter").forEach((button) =>
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document
      .querySelectorAll(".filter")
      .forEach((item) => item.classList.toggle("active", item === button));
    renderActivity();
  }),
);
document.querySelector("#export-button").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = el("a");
  anchor.href = url;
  anchor.download = `tabcash-${state.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Tab export saved");
});
document
  .querySelector("#import-button")
  .addEventListener("click", () =>
    document.querySelector("#import-file").click(),
  );
document
  .querySelector("#import-file")
  .addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      if (!validateImport(value))
        throw new Error("The selected file is not a TabCash export.");
      state = value;
      save();
      render();
      showToast("Tab imported");
    } catch (error) {
      showToast(error.message || "Could not read that tab");
    }
    event.target.value = "";
  });
render();
walletPanel();
document.querySelector("#plan-dialog .modal-desc").textContent =
  "Pay through your connected wallet, or record a confirmed payment manually. Broadcasts are pending until mined; balances change only when you record payment.";
const submissionLinks = document.querySelector("#submission-links");
const submissionReport = validateSubmission(submission);
for (const check of submissionReport.checks) {
  const node = el(check.valid && check.key !== "ember2026DonationAddress" ? "a" : "span", "",
    check.valid ? `${check.label}: ${check.key === "ember2026DonationAddress" ? check.value : "open ↗"}` : `${check.label}: ${check.requirement}`);
  if (node.tagName === "A") {
    node.href = check.value;
    node.target = "_blank";
    node.rel = "noopener noreferrer";
  }
  if (check.key === "ember2026DonationAddress") node.className = "donation-address";
  submissionLinks.append(node);
}
const readiness = document.createElement("details");
readiness.className = "submission-readiness";
readiness.append(el("summary", "", `${submissionReport.checks.filter(c => c.valid).length}/3 public submission fields pass local checks`));
const checks = el("ul");
for (const check of submissionReport.checks) checks.append(el("li", "", `${check.valid ? "Format checked" : "Pending"} — ${check.label}`));
readiness.append(checks, el("p", "", submissionReport.notice));
const judgeGuide = el("a", "", "Judge walkthrough and hosting checklist ↗");
judgeGuide.href = "./judge-guide.html";
judgeGuide.target = "_blank";
judgeGuide.rel = "noopener noreferrer";
readiness.append(judgeGuide);
submissionLinks.after(readiness);

const gettingStarted = document.createElement("details");
gettingStarted.className = "getting-started";
gettingStarted.open = localStorage.getItem("tabcash:guide-dismissed") !== "yes";
gettingStarted.innerHTML =
  '<summary>Start here · a two-minute TabCash walkthrough</summary><p>The preloaded Austin expenses are fictional sample data. No payment or transaction is simulated.</p><ol><li>Inspect the sample balances, then add an expense to see exact satoshi splitting.<button class="outline-button" data-guide-action="add-expense">Add an expense</button></li><li>Click a name in People (or focus it and press Enter) to add the actual recipient’s BCH address.</li><li>Review the settlement plan. Connecting a wallet and every real payment are explicit steps.<button class="outline-button" data-guide-action="settle-all">Review paybacks</button></li><li>After a real send, read its status and verify independently in your wallet. Record confirmation manually to update the tab.</li></ol><button id="dismiss-guide" class="outline-button">Keep this guide collapsed</button>';
document.querySelector(".hackathon-banner").after(gettingStarted);
gettingStarted
  .querySelectorAll("[data-guide-action]")
  .forEach(
    (button) =>
      (button.onclick = () =>
        document.getElementById(button.dataset.guideAction).click()),
  );
document.querySelector("#dismiss-guide").onclick = () => {
  gettingStarted.open = false;
  localStorage.setItem("tabcash:guide-dismissed", "yes");
  gettingStarted.querySelector("summary").focus();
};
