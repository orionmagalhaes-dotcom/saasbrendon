const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
  "brand-logo.png",
  "_headers"
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  const dst = path.join(dist, file);

  if (!fs.existsSync(src)) {
    console.warn(`[build] Arquivo nao encontrado, ignorado: ${file}`);
    continue;
  }

  fs.copyFileSync(src, dst);
}

console.log("Build concluido: pasta dist criada com arquivos estaticos.");
