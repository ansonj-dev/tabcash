import { decodeCashAddress, cashAddressToLockingBytecode } from "@bitauth/libauth";

export function isPublicHttpsUrl(value) {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || !host.includes(".")) return false;
    if (["localhost", "example.com", "example.net", "example.org"].some((name) => host === name || host.endsWith("." + name)) ||
        /\.(local|localhost|invalid|test|example)$/.test(host)) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 ||
          (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
    }
    return true;
  } catch { return false; }
}

export function isMainnetTokenAddress(value) {
  if (typeof value !== "string" || !value.startsWith("bitcoincash:")) return false;
  const decoded = decodeCashAddress(value);
  return typeof decoded !== "string" && decoded.prefix === "bitcoincash" &&
    ["p2pkhWithTokens", "p2shWithTokens"].includes(decoded.type) &&
    (decoded.type === "p2pkhWithTokens" ? decoded.payload.length === 20 : [20, 32].includes(decoded.payload.length)) &&
    typeof cashAddressToLockingBytecode(value) !== "string";
}

export function validateSubmission(input = {}) {
  const config = input ?? {};
  const checks = [
    { key: "widgetFactorySlideUrl", label: "Widget Factory talk/deck", valid: isPublicHttpsUrl(config.widgetFactorySlideUrl), value: config.widgetFactorySlideUrl,
      requirement: "Add the published HTTPS link to your short talk/deck." },
    { key: "sourceRepositoryUrl", label: "Source repository", valid: isPublicHttpsUrl(config.sourceRepositoryUrl), value: config.sourceRepositoryUrl,
      requirement: "Add the actual public HTTPS repository URL." },
    { key: "ember2026DonationAddress", label: "EMBER2026 voting address", valid: isMainnetTokenAddress(config.ember2026DonationAddress), value: config.ember2026DonationAddress,
      requirement: "Add your checksummed, token-enabled bitcoincash: address." },
  ];
  return { ready: checks.every((check) => check.valid), checks,
    notice: "Local format checks only. Link access, address ownership, live hosting, transactions and event eligibility require separate evidence." };
}
