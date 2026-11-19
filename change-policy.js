import { binToHex, cashAddressToLockingBytecode, publicKeyToP2pkhCashAddress, sha256, utf8ToBin } from "@bitauth/libauth";

export const CHANGE_SCAN_LIMIT = 20;

async function browserLock(name, operation) {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) throw Error("This wallet demo requires Web Locks in a secure browser context to reserve change safely across tabs");
  return locks.request(name, { mode: "exclusive" }, operation);
}

// dapp 0.2.8 derives keys but does not allocate address indices. Reservations are
// owned by this app, scoped to a hash of the shared change xpub, and retained even
// when signing is cancelled: a remote signature or broadcast may be uncertain.
export async function reserveMainnetChange({ manager, provider, storage = globalThis.localStorage, withLock = browserLock }) {
  if (provider?.network !== "mainnet") throw Error("TabCash change allocation requires its mainnet provider");
  if (!storage?.getItem || !storage?.setItem) throw Error("Persistent change reservation storage is unavailable");
  const changeXpub = () => manager.getSessionPaths().find(path => path.name === "change")?.xpub;
  const xpub = changeXpub();
  if (typeof xpub !== "string" || !xpub) throw Error("Wallet must share a change HD path");
  const identity = binToHex(sha256.hash(utf8ToBin(xpub)));
  const key = `tabcash:change:v1:${identity}`;
  return withLock(key, async () => {
    const raw = storage.getItem(key);
    const record = raw === null ? { version: 1, reserved: [] } : JSON.parse(raw);
    if (record?.version !== 1 || !Array.isArray(record.reserved) ||
        new Set(record.reserved).size !== record.reserved.length ||
        record.reserved.some(index => !Number.isInteger(index) || index < 0 || index >= CHANGE_SCAN_LIMIT))
      throw Error("Stored change reservations are malformed; preserve the records and review wallet activity before continuing");
    for (let index = 0; index < CHANGE_SCAN_LIMIT; index++) {
      if (record.reserved.includes(index)) continue;
      if (changeXpub() !== xpub) throw Error("Wallet change path changed during allocation; reconnect before retrying");
      const publicKey = manager.getPubkey(1, BigInt(index));
      if (!publicKey) throw Error("Wallet cannot derive its shared change path");
      const address = publicKeyToP2pkhCashAddress({ publicKey, prefix: "bitcoincash" }).address;
      const decoded = cashAddressToLockingBytecode(address);
      if (typeof decoded === "string") throw Error("Invalid derived change address");
      const scriptHash = binToHex(sha256.hash(decoded.bytecode).reverse());
      const history = await provider.performRequest("blockchain.scripthash.get_history", scriptHash);
      if (!Array.isArray(history)) throw Error("Change-address history is unavailable; allocation stopped");
      if (changeXpub() !== xpub) throw Error("Wallet change path changed during allocation; reconnect before retrying");
      if (history.length) continue;
      record.reserved.push(index);
      const saved = JSON.stringify(record);
      storage.setItem(key, saved);
      if (storage.getItem(key) !== saved) throw Error("Change reservation could not be saved; signing stopped");
      return { index, address };
    }
    throw Error("All first 20 change addresses are reserved or have server-reported history. This bounded demo cannot allocate another; review in your wallet or use a separate small demo wallet.");
  });
}
