// Builds docs/answers.pdf from docs/answers.md with headless Chrome or Edge.
// Usage: npm install && npm run pdf
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { marked } from "marked";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = path.join(root, "docs", "answers.md");
const htmlPath = path.join(root, "docs", "answers.html");
const pdfPath = path.join(root, "docs", "The-Date-Crew-Assessment-Answers.pdf");

const PLACEHOLDERS = ["LIVE_LINK", "REPO_LINK", "AI_DISAGREEMENT"];
let md = readFileSync(mdPath, "utf8");
const left = PLACEHOLDERS.filter((p) => md.includes(p));
if (left.length) console.warn(`Warning: placeholders still in answers.md: ${left.join(", ")}`);
for (const p of left) md = md.replaceAll(p, `<mark>[${p.replace("_", " ").toLowerCase()}]</mark>`);

const css = `
  @page { size: A4; margin: 16mm 16mm 16mm 16mm; }
  body { font: 10.5pt/1.45 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; color: #1d1d1b; }
  h1 { font-size: 19pt; margin: 0 0 6pt; }
  h2 { font-size: 14pt; margin: 14pt 0 6pt; padding-top: 4pt; border-top: 2px solid #1d1d1b; }
  h3 { font-size: 11pt; margin: 10pt 0 3pt; }
  p, li { margin: 3pt 0; }
  ul, ol { padding-left: 16pt; margin: 3pt 0; }
  hr { display: none; }
  code { font-family: Consolas, monospace; font-size: 9.5pt; background: #f1f0ec; padding: 0 3px; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9.5pt; break-inside: avoid; }
  th, td { border-bottom: 1px solid #ddd; padding: 3pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f4f3ef; }
  img { width: 100%; border: 1px solid #ccc; margin: 6pt 0; break-inside: avoid; }
  p:has(> img) { break-inside: avoid; }
  mark { background: #ffe066; padding: 0 3px; }
  a { color: #3b4fd8; }
  h2 { break-after: avoid; } h3 { break-after: avoid; }
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>The Date Crew assessment answers</title><style>${css}</style></head>
<body>${marked.parse(md)}</body></html>`;
writeFileSync(htmlPath, html);

const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) throw new Error("No Chrome/Edge found. Set CHROME_PATH.");

execFileSync(browser, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer",
  `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
], { stdio: "ignore" });
console.log(`Wrote ${path.relative(root, pdfPath)}`);
