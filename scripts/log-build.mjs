#!/usr/bin/env node
/**
 * Build logger — ghi lại mỗi lần build vào TiếnTrìnhHệThống.MD
 * Sử dụng: node scripts/log-build.mjs --package <tên> --status <success|failed> [--durationMs <ms>] [--desc <mô tả>]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOG_FILE = resolve(ROOT, "TiếnTrìnhHệThống.MD");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] ?? "";
      i++;
    }
  }
  return args;
}

function formatVietnamTime(date) {
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms) {
  if (!ms || isNaN(Number(ms))) return null;
  const n = Number(ms);
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(2)}s`;
}

const args = parseArgs(process.argv.slice(2));
const pkg     = args.package  || "unknown";
const status  = args.status   || "success";
const durMs   = args.durationMs;
const desc    = args.desc     || "";

const now   = new Date();
const stamp = formatVietnamTime(now);
const isOk  = status === "success";
const icon  = isOk ? "✅" : "❌";
const label = isOk ? "Thành công" : "Thất bại";
const dur   = formatDuration(durMs);

const lines = [
  `## ${stamp} — \`${pkg}\``,
  `- **Trạng thái:** ${icon} ${label}`,
  dur ? `- **Thời gian build:** ${dur}` : null,
  desc ? `- **Mô tả:** ${desc}` : null,
  "",
].filter((l) => l !== null).join("\n");

const existing = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, "utf8") : "";

const header = existing.startsWith("# Tiến Trình Hệ Thống")
  ? ""
  : "# Tiến Trình Hệ Thống\n\n_Log tự động — ghi lại mỗi lần build thành công_\n\n---\n\n";

const separator = existing.includes("---") ? "" : "";
writeFileSync(LOG_FILE, header + lines + "\n" + (existing ? existing.replace(/^# Tiến Trình Hệ Thống[\s\S]*?---\n\n/, "") : ""), "utf8");

console.log(`[log-build] Đã ghi: ${pkg} ${icon} lúc ${stamp}`);
