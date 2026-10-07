#!/usr/bin/env bun
// SMS / LMS / MMS 발송 (문자 길이·이미지 유무로 타입 자동 판별)
// 예)
//   bun run send.ts --to 01012345678 --text "안녕하세요"
//   bun run send.ts --to 01011112222,01033334444 --text "장문..." --subject "제목"
//   bun run send.ts --to 010... --text "사진첨부" --image ./poster.jpg
//   bun run send.ts --to 010... --text "미리보기" --dry-run
import { buildClient, defaultSender, parseArgs, toList, pretty } from "./lib/client";
import { sanitizeMessages, reportAndShouldBlock } from "./lib/sanitize";

const a = parseArgs(process.argv.slice(2));
const to = toList(a.to);
const from = (a.from as string) || defaultSender();
const text = a.text as string;

if (to.length === 0 || !text) {
  console.error("사용법: send.ts --to <번호[,번호...]> --text <내용> [--subject 제목] [--image 경로] [--from 발신번호] [--dry-run] [--force]");
  process.exit(1);
}
if (!from) {
  console.error("❌ 발신번호가 없어. --from 으로 주거나 SOLAPI_SENDER 환경변수 설정해줘. (사전 등록·인증된 번호만 가능)");
  process.exit(1);
}

const client = buildClient();

// 이미지가 있으면 MMS용으로 먼저 업로드 → imageId
let imageId: string | undefined;
if (typeof a.image === "string") {
  const up = await client.uploadFile(a.image, "MMS");
  imageId = up.fileId;
  console.log(`🖼  이미지 업로드 완료 fileId=${imageId}`);
}

const message: any = {
  to: to.length === 1 ? to[0] : to,
  from,
  text,
  autoTypeDetect: true, // 길이/이미지 보고 SMS·LMS·MMS 자동 판별
};
if (typeof a.subject === "string") message.subject = a.subject; // 있으면 LMS/MMS
if (imageId) message.imageId = imageId;

// 발송 직전 게이트 — 번호 정규화 + 깨질 글자 검사 (dry-run 에서도 돈다)
if (reportAndShouldBlock(sanitizeMessages([message]), Boolean(a.force))) process.exit(1);

if (a["dry-run"]) {
  console.log("🧪 DRY-RUN (실제 발송 안 함):");
  console.log(pretty(message));
  process.exit(0);
}

const res = await client.send(message);
console.log("✅ 발송 요청 완료");
console.log(pretty(res.groupInfo?.count ?? res));
