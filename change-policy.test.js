import test from "node:test";
import assert from "node:assert/strict";
import { DappConnectionManager } from "@wizardconnect/dapp";
import { deriveHdPrivateNodeFromSeed, deriveHdPublicNode, encodeHdPublicKey } from "@bitauth/libauth";
import { CHANGE_SCAN_LIMIT, reserveMainnetChange } from "./change-policy.js";

// These deterministic, unfunded fixtures restore public paths locally. There is
// no relay, external request, wallet signature or transaction broadcast.
function fixture(seed = 7) {
  const node = deriveHdPublicNode(deriveHdPrivateNodeFromSeed(new Uint8Array(32).fill(seed)));
  const xpub = encodeHdPublicKey({ network: "mainnet", node }).hdPublicKey;
  const manager = new DappConnectionManager("Offline API compatibility test", undefined, { session: false });
  manager.restoreSessionPaths([{ name: "receive", xpub }, { name: "change", xpub }]);
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  let chain = Promise.resolve();
  const withLock = (_name, operation) => { const result = chain.then(operation); chain = result.catch(() => {}); return result; };
  const provider = { network: "mainnet", async performRequest(method, hash) {
    assert.equal(method, "blockchain.scripthash.get_history"); assert.match(hash, /^[a-f0-9]{64}$/); return [];
  } };
  return { manager, xpub, data, storage, withLock, provider };
}

test("real dapp 0.2.8 API allocates change without absent index helpers and keeps reservations across manager recreation", async () => {
  const f = fixture();
  assert.equal(typeof f.manager.getPubkey, "function");
  assert.equal(typeof f.manager.getSessionPaths, "function");
  assert.equal(f.manager.getIndexToUse, undefined); assert.equal(f.manager.setAddressIndex, undefined);
  const first = await reserveMainnetChange(f);
  assert.equal(first.index, 0); assert.match(first.address, /^bitcoincash:/);
  const replacement = fixture();
  const second = await reserveMainnetChange({ ...f, manager: replacement.manager });
  assert.equal(second.index, 1); assert.notEqual(second.address, first.address);
  assert.equal(f.manager.loadStoredSession(), null);
  assert.equal(f.data.size, 1);
  assert.ok([...f.data.keys()].every(key => !key.includes(f.xpub)));
  assert.deepEqual(JSON.parse([...f.data.values()][0]).reserved, [0, 1]);
  await f.manager.destroy(); await replacement.manager.destroy();
});

test("server-reported history and earlier reservations are skipped rather than reused", async () => {
  const f = fixture(); let calls = 0;
  f.provider.performRequest = async () => ++calls % 2 ? [{ tx_hash: "a".repeat(64), height: 1 }] : [];
  assert.equal((await reserveMainnetChange(f)).index, 1);
  assert.equal((await reserveMainnetChange(f)).index, 2);
  assert.equal(calls, 4);
  await f.manager.destroy();
});

test("a shared lock serializes concurrent tabs; independent wallet xpubs have separate reservations", async () => {
  const f = fixture(), other = fixture(8);
  const results = await Promise.all([reserveMainnetChange(f), reserveMainnetChange(f)]);
  assert.deepEqual(results.map(result => result.index), [0, 1]);
  assert.equal((await reserveMainnetChange({ ...f, manager: other.manager })).index, 0);
  assert.equal(f.data.size, 2);
  await f.manager.destroy(); await other.manager.destroy();
});

test("unavailable history, wrong network and failed persistence stop allocation", async () => {
  const f = fixture();
  await assert.rejects(reserveMainnetChange({ ...f, provider: { ...f.provider, network: "chipnet" } }), /mainnet provider/);
  await assert.rejects(reserveMainnetChange({ ...f, provider: { ...f.provider, performRequest: async () => null } }), /history is unavailable/);
  await assert.rejects(reserveMainnetChange({ ...f, provider: { ...f.provider, performRequest: async () => { throw Error("offline"); } } }), /offline/);
  assert.equal(f.data.size, 0);
  await assert.rejects(reserveMainnetChange({ ...f, storage: { getItem: () => null, setItem: () => { throw Error("storage full"); } } }), /storage full/);
  await assert.rejects(reserveMainnetChange({ ...f, storage: { getItem: () => null, setItem: () => {} } }), /could not be saved/);
  await f.manager.destroy();
});

test("corrupt reservations and the bounded demo's exhaustion fail closed", async () => {
  const f = fixture(); await reserveMainnetChange(f);
  const key = [...f.data.keys()][0];
  f.data.set(key, JSON.stringify({ version: 1, reserved: [0, 0] }));
  await assert.rejects(reserveMainnetChange(f), /malformed/);
  f.data.set(key, JSON.stringify({ version: 1, reserved: Array.from({ length: CHANGE_SCAN_LIMIT }, (_, i) => i) }));
  await assert.rejects(reserveMainnetChange(f), /first 20 change addresses/);
  await f.manager.destroy();
});

test("wallet path changes during history lookup cannot reserve under an old identity", async () => {
  const f = fixture(), other = fixture(8);
  f.provider.performRequest = async () => { f.manager.restoreSessionPaths(other.manager.getSessionPaths()); return []; };
  await assert.rejects(reserveMainnetChange(f), /path changed/);
  assert.equal(f.data.size, 0);
  await f.manager.destroy(); await other.manager.destroy();
});
