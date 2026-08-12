import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const excludedDirs = new Set(["node_modules", ".next", ".git"]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (excludedDirs.has(entry.name)) return [];
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

const violations = [];
const comandaFiles = [
  ...walk(path.join(root, "products", "comanda")),
  ...walk(path.join(root, "app", "comanda")),
];

for (const file of comandaFiles) {
  const contents = fs.readFileSync(file, "utf8");
  const forbiddenHotelReferences = [
    "app/dashboard",
    "app/hosteria-durazno",
    "products/habitacion",
  ];

  for (const forbidden of forbiddenHotelReferences) {
    if (contents.includes(forbidden)) {
      violations.push(`${relative(file)} references hotel-only code: ${forbidden}`);
    }
  }
}

for (const file of walk(root)) {
  const rel = relative(file);
  const isComanda = rel.startsWith("products/comanda/") || rel.startsWith("app/comanda/");
  const isBoundaryScript = rel === "scripts/check-product-boundaries.mjs";
  if (isComanda || isBoundaryScript) continue;

  const contents = fs.readFileSync(file, "utf8");
  if (contents.includes("products/comanda")) {
    violations.push(`${rel} imports Comanda-specific code outside the Comanda entrypoint`);
  }
}

if (violations.length) {
  console.error("Product boundary check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Product boundaries OK: Habitación Llena and Comanda Llena remain isolated.");
