import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { submission } from "../submission.js";
import { validateSubmission } from "../submission-validation.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const preview = process.argv.includes("--preview"), report = validateSubmission(submission);
if (!preview && !report.ready) throw Error("Public submission configuration is incomplete. Run npm run check:submission; use package:preview for local review.");
if (!existsSync(join(root, "dist/index.html"))) throw Error("Build the browser app before packaging.");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = join(root, "release", `tabcash-${preview ? "PREVIEW" : "release"}-${stamp}`);
mkdirSync(destination, { recursive: true });
cpSync(join(root, "dist"), join(destination, "site"), { recursive: true });
const handoff = `TabCash ${preview ? "LOCAL PREVIEW — PUBLIC CONFIGURATION MAY BE INCOMPLETE" : "RELEASE CANDIDATE — EXTERNAL EVIDENCE STILL REQUIRED"}\n\nUpload only site/ contents to an HTTPS host at the domain root.\nOpen site/judge-guide.html for the walkthrough and hosting checklist.\nThe build contains public data only; no signing keys or server are required.\n\n${report.checks.map(c => `${c.valid ? "FORMAT CHECKED" : "PENDING"}: ${c.label}`).join("\n")}\n\n${report.notice}\n\nExternal gates: publish and verify live demo/repository/talk; verify voting-address ownership; capture an explicitly authorized useful mainnet transaction; verify event participation and submission. No deployment, account action, message or transaction is performed by this package.\n`;
writeFileSync(join(destination, "HANDOFF.txt"), handoff);
function files(directory) {
  return readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const manifest = { product: "TabCash", createdAt: new Date().toISOString(), mode: preview ? "local-preview" : "release-candidate",
  publicConfigurationValid: report.ready, externalEvidenceVerified: false,
  files: files(destination).map(path => ({ path: relative(destination, path).replaceAll("\\", "/"), bytes: statSync(path).size, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") })) };
writeFileSync(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const archive = destination + ".zip";
if (process.platform === "win32") {
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", resolve(root, "scripts/archive-release.ps1"), "-SourceDirectory", destination, "-DestinationPath", archive], { stdio: "inherit" });
  console.log("Local archive: " + archive);
} else console.log("Release folder prepared; ZIP packaging currently uses Windows Compress-Archive.");
console.log("Local release folder: " + destination);
console.log(report.notice);
