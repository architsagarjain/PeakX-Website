// Builds the PeakX app (tracker/, React + Vite) and copies it into public/ so Next serves it:
//   public/app/       the app itself, at peakx.in/app (hash routes: /app/#/app/log …)
//   public/_pages/    calorie guide and blog pages, served at peakx.in/calories/… and /blog/… (see next.config.ts)
//   public/sitemap-app.xml
// These folders are generated on every build and git-ignored.
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const tracker = join(root, "tracker");
const dist = join(tracker, "dist");
const pub = join(root, "public");
const run = (cmd, env = {}) => execSync(cmd, { cwd: tracker, stdio: "inherit", env: { ...process.env, ...env } });

// --include=dev: Vercel builds with NODE_ENV=production, which would otherwise skip Vite
if (!existsSync(join(tracker, "node_modules", ".bin", "vite"))) run("npm ci --include=dev");
run("npm run build:site", { VITE_SITE_URL: process.env.VITE_SITE_URL || "https://www.peakx.in" });

for (const dir of ["app", "_pages"]) rmSync(join(pub, dir), { recursive: true, force: true });
for (const item of ["index.html", "assets", "icons", "screenshots", "favicon.svg", "manifest.webmanifest", "og.png", "sw.js"]) {
  cpSync(join(dist, item), join(pub, "app", item), { recursive: true });
}
cpSync(join(dist, "calories"), join(pub, "_pages", "calories"), { recursive: true });
cpSync(join(dist, "blog"), join(pub, "_pages", "blog"), { recursive: true });
cpSync(join(dist, "sitemap.xml"), join(pub, "sitemap-app.xml"));
console.log("PeakX app copied into public/app and public/_pages");
