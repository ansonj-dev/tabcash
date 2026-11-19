import { submission } from "../submission.js";
import { validateSubmission } from "../submission-validation.js";
const report = validateSubmission(submission);
for (const check of report.checks)
  console.log(`${check.valid ? "PASS" : "MISSING/INVALID"} ${check.key}: ${check.valid ? check.value : check.requirement}`);
console.log(report.notice);
if (process.argv.includes("--strict") && !report.ready) process.exitCode = 1;
