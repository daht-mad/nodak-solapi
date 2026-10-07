#!/usr/bin/env bun
// 대량 발송 — 수신자마다 내용이 다를 때. JSON 배열 파일을 받아 한 번에 쏜다.
// 각 원소는 솔라피 메시지 객체(to/from/text/subject/type/kakaoOptions...).
// from 이 비어있으면 SOLAPI_SENDER 로 채워준다.
//
// 예) messages.json:
// [
//   {"to":"01011112222","text":"홍길동님 안녕하세요"},
//   {"to":"01033334444","text":"김철수님 안녕하세요","subject":"안내"}
// ]
//   bun run send-many.ts --file messages.json
//   bun run send-many.ts --file messages.json --dry-run
import { buildClient, defaultSender, parseArgs, pretty } from "./lib/client";
import { sanitizeMessages, reportAndShouldBlock } from "./lib/sanitize";

const a = parseArgs(process.argv.slice(2));
const file = a.file as string;
if (!file) {
  console.error("사용법: send-many.ts --file <messages.json> [--dry-run] [--force]");
  process.exit(1);
}

const raw = await Bun.file(file).text();
let messages: any[];
try {
  messages = JSON.parse(raw);
} catch {
  console.error("❌ JSON 파싱 실패. 배열이어야 해.");
  process.exit(1);
}
if (!Array.isArray(messages) || messages.length === 0) {
  console.error("❌ 비어있거나 배열이 아니야.");
  process.exit(1);
}

const from = defaultSender();
for (const m of messages) {
  if (!m.from && from) m.from = from;
  if (m.autoTypeDetect === undefined && !m.type) m.autoTypeDetect = true;
}

console.log(`📦 ${messages.length}건 준비`);

// 발송 직전 게이트 — 번호 정규화 + 깨질 글자 검사 (dry-run 에서도 돈다)
if (reportAndShouldBlock(sanitizeMessages(messages), Boolean(a.force))) process.exit(1);

if (a["dry-run"]) {
  console.log("🧪 DRY-RUN (실제 발송 안 함). 앞 3건 미리보기:");
  console.log(pretty(messages.slice(0, 3)));
  process.exit(0);
}

const client = buildClient();
const res = await client.send(messages);
console.log("✅ 대량 발송 요청 완료");
console.log(pretty(res.groupInfo?.count ?? res));
