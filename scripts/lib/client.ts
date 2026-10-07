// 공용 클라이언트 + 인자 파서
// 공식 SDK(solapi, SolapiMessageService)를 물어 HMAC 인증을 자동 처리한다.
import { SolapiMessageService } from "solapi";
import { wrapWithNightGuard } from "./night-guard";

export function buildClient(): SolapiMessageService {
  const key = process.env.SOLAPI_API_KEY;
  const secret = process.env.SOLAPI_API_SECRET;
  if (!key || !secret) {
    console.error(
      "❌ SOLAPI_API_KEY / SOLAPI_API_SECRET 이 없어.\n" +
        "   처음이면 셋업부터: bun run scripts/setup.ts",
    );
    process.exit(1);
  }
  // 야간(21~08시 KST) 발송 차단을 send()에 물린다.
  // 여기 한 곳에 걸면 모든 발송 스크립트가 자동으로 보호된다.
  return wrapWithNightGuard(new SolapiMessageService(key, secret));
}

// 기본 발신번호 (콘솔에 사전 등록·인증된 번호여야 함)
export function defaultSender(): string | undefined {
  return process.env.SOLAPI_SENDER;
}

// --key value / --flag 형태의 아주 단순한 인자 파서
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[k] = true;
    } else {
      out[k] = next;
      i++;
    }
  }
  return out;
}

// "010...,010..." → ["010...","010..."]
export function toList(v: string | boolean | undefined): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pretty(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}
