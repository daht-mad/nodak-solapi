#!/usr/bin/env bun
// 승인된 알림톡 템플릿 목록 조회 → pfId / templateId 확인용
// (send-alimtalk.ts 쓰기 전에 여기서 ID 먼저 확인)
//   bun run templates.ts
//   bun run templates.ts --name 수강안내   # 이름 부분일치 필터
import { buildClient, parseArgs, pretty } from "./lib/client";

const a = parseArgs(process.argv.slice(2));
const client = buildClient();

const res: any = await client.getKakaoAlimtalkTemplates(
  typeof a.name === "string" ? ({ name: a.name } as any) : undefined,
);

const list: any[] = res.templateList ?? res.list ?? res.kakaoAlimtalkTemplateList ?? [];
if (list.length === 0) {
  console.log("템플릿이 없거나 응답 구조가 달라. 원본:");
  console.log(pretty(res));
  process.exit(0);
}

console.log(`📋 알림톡 템플릿 ${list.length}개`);
for (const t of list) {
  console.log(`\n• ${t.name ?? "(이름없음)"}  [${t.status ?? "?"}]`);
  console.log(`  templateId: ${t.templateId ?? t.id}`);
  if (t.channelId ?? t.pfId) console.log(`  pfId(채널): ${t.channelId ?? t.pfId}`);
  if (t.content) console.log(`  본문: ${String(t.content).replace(/\n/g, " ").slice(0, 60)}...`);
}
