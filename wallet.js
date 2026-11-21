import { assertPaymentMatches } from "./payment.js";
import { reserveMainnetChange } from "./change-policy.js";
import { initiateDappRelay } from "@wizardconnect/core";
import { DappConnectionManager } from "@wizardconnect/dapp";
import {
  ElectrumNetworkProvider,
  TransactionBuilder,
  placeholderP2PKHUnlocker,
} from "cashscript";
import {
  publicKeyToP2pkhCashAddress,
  cashAddressToLockingBytecode,
  hexToBin,
  binToHex,
  decodeTransaction,
  hashTransactionUiOrder,
} from "@bitauth/libauth";
import QRCode from "qrcode";
import { validMainnetAddress } from "./address.js";
import iconUrl from "./icon.svg?url";

export { validMainnetAddress };
let manager;
let workspaceMode = "sample";
const provider = new ElectrumNetworkProvider("mainnet");
let relay,
  ready = false,
  busy = false,
  controller;
const status = (text) =>
  (document.querySelector("#wallet-status").textContent = text);
function syncWalletButton() {
  const button = document.querySelector("#connect-wallet");
  if (!button) return;
  const sampleMode = workspaceMode !== "real";
  button.disabled = sampleMode;
  button.textContent = sampleMode
    ? "Wallet · My tab only"
    : ready
      ? "Wallet connected"
      : "Connect wallet";
  button.title = sampleMode
    ? "Switch to My tab before connecting a wallet."
    : "Connect a WizardConnect HD wallet on BCH mainnet.";
  button.setAttribute(
    "aria-label",
    sampleMode ? "Wallet connection is available only in My tab" : button.textContent,
  );
}
export function setWalletWorkspace(mode) {
  workspaceMode = mode === "real" ? "real" : "sample";
  syncWalletButton();
}
const address = (path, index) => {
  const publicKey = manager.getPubkey(path, BigInt(index));
  if (!publicKey) throw Error("Wallet must share receive and change HD paths");
  return publicKeyToP2pkhCashAddress({ publicKey, prefix: "bitcoincash" })
    .address;
};
export function walletPanel() {
  const newManager = () => {
    const next = new DappConnectionManager(
      "TabCash",
      new URL(iconUrl, location.href).href,
      { session: false },
    );
    next.on("walletready", (msg) => {
      if (manager !== next) return;
      try {
        address(1, 0);
        ready = true;
        status(
          `${msg.wallet_name} connected. Receive address: ${address(0, 0)}. Mainnet BCH only.`,
        );
        syncWalletButton();
      } catch (e) {
        ready = false;
        status(e.message);
      }
    });
    next.on("disconnect", () => {
      if (manager !== next) return;
      ready = false;
      relay?.cleanup();
      status("Wallet disconnected");
      syncWalletButton();
    });
    return next;
  };
  manager = newManager();
  document.querySelector("#connect-wallet").onclick = () => {
    if (workspaceMode !== "real") return;
    document.querySelector("#wallet-dialog").showModal();
  };
  syncWalletButton();
  document.querySelector("#start-pairing").onclick = async () => {
    try {
      if (workspaceMode !== "real")
        throw Error("Switch to My tab before connecting a wallet.");
      if (busy)
        throw Error("Finish or cancel the current signing request first");
      if (relay) relay.cleanup();
      await manager.destroy();
      manager = newManager();
      const pairingManager = manager;
      ready = false;
      syncWalletButton();
      relay = initiateDappRelay((payload) => {
        if (manager !== pairingManager) return;
        pairingManager.updateConnection(payload.client, payload.status);
        if (!ready)
          status(
            `Relay: ${payload.status.status}. Scan with a WizardConnect HD wallet.`,
          );
      });
      document.querySelector("#pairing-uri").value = relay.uri;
      document.querySelector("#wallet-qr").src = await QRCode.toDataURL(
        relay.qrUri,
        { width: 240, margin: 2 },
      );
      document.querySelector("#wallet-qr").hidden = false;
    } catch (e) {
      status(e.message);
    }
  };
  document.querySelector("#disconnect-wallet").onclick = async () => {
    controller?.abort();
    await manager.sendDisconnect("User disconnected");
    manager.clearStoredSession();
    relay?.cleanup();
    relay = null;
    ready = false;
    status("Disconnected; session was not persisted.");
    syncWalletButton();
  };
  document.querySelector("#cancel-signing").onclick = () =>
    controller?.abort("User cancelled");
}
export async function readPaymentStatus(txid) {
  if (!/^[a-f0-9]{64}$/.test(txid)) throw Error("Invalid transaction ID");
  try {
    const details = await provider.performRequest(
      "blockchain.transaction.get",
      txid,
      true,
    );
    const confirmations =
      typeof details === "object" &&
      Number.isSafeInteger(details.confirmations) &&
      details.confirmations >= 0
        ? details.confirmations
        : null;
    return {
      txid,
      observedAt: new Date().toISOString(),
      confirmations,
      status:
        confirmations === null
          ? "server saw transaction; confirmation depth unavailable"
          : confirmations > 0
            ? "server reports block confirmation"
            : "server reports unconfirmed",
      source:
        "one mainnet Electrum server; verify independently in your wallet",
    };
  } catch {
    return {
      txid,
      observedAt: new Date().toISOString(),
      confirmations: null,
      status: "status unavailable; this does not prove rejection or absence",
      source: "Electrum query failed or verbose lookup unsupported",
    };
  }
}
export async function payMainnet({ to, amount, prompt, onSigned }) {
  if (workspaceMode !== "real")
    throw Error("Switch to My tab before sending real BCH.");
  if (busy) throw Error("A payment is already being prepared");
  if (!ready) {
    document.querySelector("#wallet-dialog").showModal();
    throw Error("Connect a WizardConnect HD wallet first");
  }
  if (!validMainnetAddress(to))
    throw Error("Recipient needs a valid full mainnet CashAddress");
  if (!Number.isSafeInteger(amount) || amount < 546 || amount > 1000000)
    throw Error(
      "Live demo payments are limited to 546–1,000,000 satoshis (0.01 BCH)",
    );
  if (!document.querySelector("#mainnet-consent").checked) {
    document.querySelector("#wallet-dialog").showModal();
    throw Error("Confirm mainnet use in the wallet panel first");
  }
  busy = true;
  try {
    status(
      "Looking for a BCH-only spendable output. Token UTXOs are excluded.",
    );
    // Bounded scan keeps the demo responsive and never mixes users or tokens.
    let chosen;
    for (const path of [0, 1]) {
      for (let index = 0; index < 20 && !chosen; index++) {
        const from = address(path, index);
        const candidates = await provider.getUtxos(from);
        const utxo = candidates
          .filter((u) => !u.token && u.satoshis >= BigInt(amount) + 1546n)
          .sort((a, b) => Number(a.satoshis - b.satoshis))[0];
        if (utxo) chosen = { utxo, from, path, index };
      }
      if (chosen) break;
    }
    if (!chosen)
      throw Error(
        "No sufficiently funded BCH-only output in the first 20 receive/change addresses. Fund receive index 0 shown above, then retry.",
      );
    status("Checking change-address history and reserving an index in this browser…");
    const change = await reserveMainnetChange({ manager, provider });
    if (!ready) throw Error("Wallet disconnected during preparation; signing stopped");
    const fee = 1000n;
    const tx = new TransactionBuilder({
      provider,
      maximumFeeSatoshis: fee,
      maximumFeeSatsPerByte: 10,
    })
      .addInput(chosen.utxo, placeholderP2PKHUnlocker(chosen.from))
      .addOutput({ to, amount: BigInt(amount) })
      .addOutput({
        to: change.address,
        amount: chosen.utxo.satoshis - BigInt(amount) - fee,
      });
    const request = tx.generateWcTransactionObject({
      broadcast: false,
      userPrompt: prompt,
    });
    if (
      !confirm(
        `BCH MAINNET payment\n\nSend ${(amount / 1e8).toFixed(8)} BCH to:\n${to}\n\nFee: 0.00001000 BCH (1,000 sats).\nChange returns to your connected wallet.\n\nReview the same details in your wallet to authorize.`,
      )
    )
      throw Error("Payment cancelled");
    controller = new AbortController();
    status(
      "Awaiting your wallet signature. Closing a dialog does not approve payment.",
    );
    const response = await manager.signTransaction(
      {
        transaction: request,
        inputPaths: [
          [0, chosen.path === 0 ? "receive" : "change", chosen.index],
        ],
      },
      { signal: controller.signal },
    );
    if (response.error) throw Error(response.error);
    const raw = hexToBin(response.signedTransaction),
      signed = decodeTransaction(raw);
    if (typeof signed === "string")
      throw Error("Wallet returned an invalid transaction");
    assertPaymentMatches(signed, request.transaction);
    status("Wallet signed. Broadcasting to BCH mainnet…");
    const txid = binToHex(hashTransactionUiOrder(raw));
    // Save the ID before broadcast so an interrupted response cannot look like an unsent payment.
    if (onSigned) await onSigned(txid);
    try {
      await provider.sendRawTransaction(response.signedTransaction);
    } catch {
      throw Error(
        `Broadcast outcome unknown. Transaction ID ${txid} was saved before sending. Check it in your wallet before any retry.`,
      );
    }
    status(
      `Broadcast accepted: ${txid}. This is pending, not block confirmation.`,
    );
    return txid;
  } finally {
    busy = false;
    controller = null;
  }
}
