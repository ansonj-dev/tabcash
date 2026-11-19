// Pure ledger functions are shared by the UI and offline regression tests.
export function validateImport(value) {
  if (!value || value.version !== 1 || typeof value.title !== "string" ||
      !Array.isArray(value.people) || !value.people.length ||
      !Array.isArray(value.events)) return false;
  const ids = new Set();
  for (const p of value.people) {
    if (!p || typeof p.id !== "string" || !p.id || ids.has(p.id) ||
        typeof p.name !== "string" || typeof p.address !== "string" ||
        typeof p.color !== "string") return false;
    ids.add(p.id);
  }
  if (!ids.has(value.me)) return false;
  const events = new Set();
  let total = 0;
  for (const e of value.events) {
    if (!e || typeof e.id !== "string" || events.has(e.id) ||
        !Number.isSafeInteger(e.amount) || e.amount <= 0 ||
        typeof e.at !== "string" || !Number.isFinite(Date.parse(e.at))) return false;
    events.add(e.id);
    total += e.amount;
    if (!Number.isSafeInteger(total)) return false;
    if (e.type === "expense") {
      if (!ids.has(e.payer) || typeof e.description !== "string" ||
          !Array.isArray(e.split) || !e.split.length ||
          e.split.some((pid) => !ids.has(pid))) return false;
    } else if (e.type === "settlement") {
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) return false;
    } else return false;
  }
  if (value.payments !== undefined && (!Array.isArray(value.payments) ||
      value.payments.some((p) => !p || !ids.has(p.from) || !ids.has(p.to) ||
        !Number.isSafeInteger(p.amount) || p.amount <= 0 ||
        !/^[a-f0-9]{64}$/.test(p.txid)))) return false;
  return true;
}

export function balancesFor(state) {
  const net = Object.fromEntries(state.people.map((p) => [p.id, 0]));
  for (const event of state.events) {
    if (event.type === "expense") {
      const members = [...new Set(event.split)];
      net[event.payer] += event.amount;
      const share = Math.floor(event.amount / members.length);
      let remainder = event.amount - share * members.length;
      members.forEach((pid) => { net[pid] -= share + (remainder-- > 0 ? 1 : 0); });
    } else if (event.type === "settlement") {
      net[event.from] += event.amount;
      net[event.to] -= event.amount;
    }
  }
  return net;
}

export function planFor(net) {
  const sides = (positive) => Object.entries(net)
    .filter(([, amount]) => positive ? amount > 0 : amount < 0)
    .map(([pid, amount]) => ({ pid, amount: Math.abs(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = sides(false), creditors = sides(true), result = [];
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) result.push({ from: debtors[d].pid, to: creditors[c].pid, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (!debtors[d].amount) d++;
    if (!creditors[c].amount) c++;
  }
  return result;
}
