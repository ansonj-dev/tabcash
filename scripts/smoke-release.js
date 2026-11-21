import { spawn } from "node:child_process";
import { once } from "node:events";
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "14100", "--strictPort"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
let output = "";
child.stdout.on("data", data => { output += data; });
child.stderr.on("data", data => { output += data; });
try {
  for (let i = 0; i < 100 && !output.includes("14100"); i++) {
    if (child.exitCode !== null) throw Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!output.replace(/\x1b\[[0-9;]*m/g, "").includes("Local:") || child.exitCode !== null) throw Error(output || "Preview did not start");
  const root = "http://127.0.0.1:14100";
  const page = await fetch(root + "/");
  if (page.status !== 200) throw Error("Production index did not load");
  const html = await page.text();
  const paths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1]);
  if (paths.length < 2) throw Error("Expected bundled JavaScript and stylesheet");
  for (const path of paths) if ((await fetch(root + path)).status !== 200) throw Error("Missing build asset: " + path);
  const guide = await fetch(root + "/judge-guide.html");
  if (guide.status !== 200 || !(await guide.text()).includes("A two-minute walkthrough without funds")) throw Error("Bundled judge guide missing");
  console.log(`PASS production HTTP smoke: index, ${paths.length} bundled assets, judge guide. No wallet or network transaction requested.`);
} finally {
  if (child.exitCode === null) {
    const ended = once(child, "exit"); child.kill(); await ended;
  }
}
