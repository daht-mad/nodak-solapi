#!/usr/bin/env bun
// 카카오 알림톡(ATA) 발송 — 사전 승인된 템플릿 기반
// 예)
//   bun run send-alimtalk.ts \
//     --to 01012345678 --from 15771603 \
//     --pfId KA01PF... --templateId KA01TP... \
//     --variables '{"#{이름}":"홍길동","#{날짜}":"8/20"}' \
//     --text "홍길동님 안내드립니다..."   # 대체발송(SMS) 본문, 승인 템플릿과 일치해야 함
//
// 실패 시 SMS로 대체발송하려면 --fallback (기본 꺼짐). --disable-sms 로 대체발송 완전 차단.
import { buildClient, defaultSender, parseArgs, toList, pretty } from "./lib/client";

const a = parseArgs(process.argv.slice(2));
const to = toList(a.to);
const from = (a.from as string) || defaultSender();
const pfId = a.pfId as string;
const templateId = a.templateId as string;

if (to.length === 0 || !pfId || !templateId) {
  console.error("사용법: send-alimtalk.ts --to <번호[,...]> --pfId <채널ID> --templateId <템플릿ID> [--variables '{\"#{키}\":\"값\"}'] [--text 대체본문] [--from 발신] [--fallback] [--disable-sms] [--dry-run]");
  console.error("👉 pfId/templateId 모르면: bun run templates.ts 로 목록 확인");
  process.exit(1);
}
if (!from) {
  console.error("❌ 발신번호 필요 (--from 또는 SOLAPI_SENDER). 대체발송(SMS) 발신자로 쓰여.");
  process.exit(1);
}

let variables: Record<string, string> = {};
if (typeof a.variables === "string") {
  try {
    variables = JSON.parse(a.variables);
  } catch {
    console.error("❌ --variables 는 JSON이어야 해. 예: '{\"#{이름}\":\"홍길동\"}'");
    process.exit(1);
  }
}

const kakaoOptions: any = { pfId, templateId, variables };
// disableSms=true → 알림톡 실패해도 SMS 대체발송 안 함
if (a["disable-sms"] || !a.fallback) kakaoOptions.disableSms = true;

const message: any = {
  to: to.length === 1 ? to[0] : to,
  from,
  type: "ATA",
  kakaoOptions,
};
if (typeof a.text === "string") message.text = a.text; // 대체발송 본문

const client = buildClient();

if (a["dry-run"]) {
  console.log("🧪 DRY-RUN (실제 발송 안 함):");
  console.log(pretty(message));
  process.exit(0);
}

const res = await client.send(message);
console.log("✅ 알림톡 발송 요청 완료");
console.log(pretty(res.groupInfo?.count ?? res));
