#!/usr/bin/env bun
// 첫 셋업 도우미 — 몇 번이고 다시 돌려도 안전하다 (값을 지우거나 덮어쓰지 않음)
//   bun run scripts/setup.ts            점검 + 빈 칸 있으면 .env 를 편집기로 열어줌
//   bun run scripts/setup.ts --no-open  편집기는 열지 않고 점검만
//
// 키 값은 절대 화면에 찍지 않는다. "채워짐/비어 있음"만 말한다.
// 종료코드: 0 = 연결 성공 · 2 = 사람이 할 차례(.env 채우기 등) · 1 = 오류
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(SKILL_DIR, ".env");
const EXAMPLE_PATH = join(SKILL_DIR, ".env.example");
const NO_OPEN = process.argv.includes("--no-open");

const FIELDS = [
  { key: "SOLAPI_API_KEY", label: "API Key", where: "솔라피 콘솔 → 개발/연동 → API Key 관리" },
  { key: "SOLAPI_API_SECRET", label: "API Secret", where: "API Key 만들 때 딱 한 번 보이는 값" },
  { key: "SOLAPI_SENDER", label: "발신번호", where: "솔라피 콘솔에 등록·인증한 내 번호 (숫자만)" },
];
const PLACEHOLDERS = ["발급받은_API_KEY", "발급받은_API_SECRET", "01000000000", ""];

function step(n: number, msg: string) {
  console.log(`\n[${n}] ${msg}`);
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function openInEditor(path: string): boolean {
  if (NO_OPEN || process.env.SSH_CONNECTION) return false;
  const cmd =
    process.platform === "darwin" ? ["open", ["-t", path]]
    : process.platform === "win32" ? ["notepad", [path]]
    : process.env.DISPLAY ? ["xdg-open", [path]]
    : null;
  if (!cmd) return false;
  const r = spawnSync(cmd[0] as string, cmd[1] as string[], { stdio: "ignore", detached: true });
  return r.error === undefined && (r.status === 0 || r.status === null);
}

async function publicIp(): Promise<string | null> {
  try {
    const r = await fetch("https://ifconfig.me/ip", { signal: AbortSignal.timeout(5000) });
    return (await r.text()).trim();
  } catch {
    return null;
  }
}

// 1) 의존성
step(1, "의존성 확인");
if (!existsSync(join(SKILL_DIR, "node_modules", "solapi"))) {
  console.log("   solapi SDK가 없어서 설치할게 (bun install)");
  const r = spawnSync("bun", ["install"], { cwd: SKILL_DIR, stdio: "inherit" });
  if (r.status !== 0) {
    console.error("❌ bun install 실패. bun이 깔려 있는지 확인해줘: https://bun.sh");
    process.exit(1);
  }
}
console.log("   ✅ solapi SDK 있음");

// 2) .env 파일
step(2, ".env 파일 확인");
if (!existsSync(ENV_PATH)) {
  copyFileSync(EXAMPLE_PATH, ENV_PATH);
  console.log("   📄 .env 가 없어서 빈 틀을 만들었어");
} else {
  console.log("   ✅ .env 있음");
}

// 3) 값 채워졌나 (값 자체는 안 보여줌)
// 우선순위는 발송 스크립트와 같게 — 이미 셸/워크스페이스에 있는 값이 .env보다 먼저다.
step(3, "값 확인 (값은 화면에 안 찍어)");
const fileEnv = parseEnv(readFileSync(ENV_PATH, "utf8"));
const env: Record<string, string> = {};
for (const f of FIELDS) {
  const fromShell = (process.env[f.key] ?? "").trim();
  env[f.key] = PLACEHOLDERS.includes(fromShell) ? (fileEnv[f.key] ?? "") : fromShell;
}
const fromShellKeys = FIELDS.filter(
  (f) => !PLACEHOLDERS.includes((process.env[f.key] ?? "").trim()),
).map((f) => f.label);
if (fromShellKeys.length)
  console.log(`   ℹ️ ${fromShellKeys.join("·")}는 .env 말고 셸/워크스페이스 환경변수에서 왔어`);
const missing: typeof FIELDS = [];
const warnings: string[] = [];
for (const f of FIELDS) {
  const v = (env[f.key] ?? "").trim();
  if (PLACEHOLDERS.includes(v)) {
    missing.push(f);
    console.log(`   ⬜ ${f.label} — 비어 있음`);
    continue;
  }
  if (/^["'].*["']$/.test(v)) warnings.push(`${f.label} 앞뒤 따옴표는 빼줘`);
  if (/\s/.test(v)) warnings.push(`${f.label} 중간에 띄어쓰기가 섞였어 (복사할 때 같이 딸려옴)`);
  if (f.key === "SOLAPI_SENDER" && !/^0\d{8,10}$/.test(v.replace(/-/g, "")))
    warnings.push("발신번호는 0으로 시작하는 숫자만 (예: 01012345678)");
  console.log(`   ✅ ${f.label} — 채워짐`);
}

if (missing.length) {
  const opened = openInEditor(ENV_PATH);
  console.log(
    `\n👤 사람이 할 차례 — 아래 파일에 값을 붙여넣고 저장해줘\n` +
      `   파일: ${ENV_PATH}\n` +
      (opened ? "   (편집기로 열어뒀어)\n" : "   (편집기를 못 열었어. 위 경로를 직접 열어줘)\n") +
      missing.map((f) => `   • ${f.key}= 뒤에 ${f.label} — ${f.where}`).join("\n") +
      `\n   ⚠️ 키는 채팅·DM에 붙여넣지 말 것. 이 파일에만.\n` +
      `   저장했으면 봇한테 "솔라피 셋업 다시 확인해줘"라고 하면 돼.\n` +
      `   (이미 다른 데 환경변수로 넣어뒀다면 그쪽이 먼저 쓰여. 이 파일은 안 건드려도 돼)\n` +
      `   키 발급 방법: references/setup-guide.md`,
  );
  process.exit(2);
}
if (warnings.length) {
  console.log(`\n⚠️ 고칠 것\n${warnings.map((w) => `   • ${w}`).join("\n")}`);
  openInEditor(ENV_PATH);
  process.exit(2);
}

// 4) 실제 연결 (잔액 조회 — 돈 안 나감)
step(4, "솔라피 연결 시험 (잔액 조회, 문자 안 나감)");
const { SolapiMessageService } = await import("solapi");
const client = new SolapiMessageService(
  env.SOLAPI_API_KEY.trim(),
  env.SOLAPI_API_SECRET.trim(),
);
try {
  const bal: any = await client.getBalance();
  console.log(`   ✅ 연결 성공 — 잔액 ${bal?.balance ?? "?"}원 · 포인트 ${bal?.point ?? "?"}`);
  if ((bal?.balance ?? 0) + (bal?.point ?? 0) < 100)
    console.log("   ⚠️ 잔액이 거의 없어. 솔라피 콘솔에서 충전해야 문자가 나가");
  console.log(
    `\n🎉 셋업 끝. 마지막으로 주인 번호로 시험 문자 1통 보내보자:\n` +
      `   bun run scripts/send.ts --to <주인 번호> --text "솔라피 연결 시험" --dry-run\n` +
      `   (번호는 주인한테 채널에서 확인받고, dry-run 확인 뒤 --dry-run 떼고 실제 발송)`,
  );
  process.exit(0);
} catch (e: any) {
  const msg = String(e?.message ?? e);
  console.error(`   ❌ 연결 실패: ${msg}`);
  if (/ip|허용|whitelist|forbidden|403/i.test(msg)) {
    const ip = await publicIp();
    console.error(
      `\n👤 허용 IP 문제로 보여. 솔라피 콘솔 → API Key → 허용 IP에 이 머신 IP를 넣거나 [모든 IP 허용]으로 바꿔줘\n` +
        `   이 머신 공인 IP: ${ip ?? "(확인 실패 — 이 머신에서 https://ifconfig.me 열어보기)"}\n` +
        `   자세히: references/setup-guide.md`,
    );
  } else if (/signature|auth|credential|invalid|401|ValidationError|length/i.test(msg)) {
    console.error("\n👤 키나 시크릿이 틀렸어. .env 값을 다시 복사해 넣어줘 (시크릿 잃어버렸으면 키 재발급)");
    openInEditor(ENV_PATH);
  }
  process.exit(2);
}
