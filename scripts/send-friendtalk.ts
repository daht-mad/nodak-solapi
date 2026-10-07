#!/usr/bin/env bun
// 카카오 친구톡 발송 — CTA(텍스트) / CTI(이미지). 채널 친구에게만 발송 가능(광고성).
// 예)
//   bun run send-friendtalk.ts --to 010... --from 15771603 --pfId KA01PF... --text "이번주 웨비나 안내 🎉"
//   bun run send-friendtalk.ts --to 010... --pfId KA01PF... --text "..." --image ./card.jpg   # 이미지형 CTI
import { buildClient, defaultSender, parseArgs, toList, pretty } from "./lib/client";

const a = parseArgs(process.argv.slice(2));
const to = toList(a.to);
const from = (a.from as string) || defaultSender();
const pfId = a.pfId as string;
const text = a.text as string;

if (to.length === 0 || !pfId || !text) {
  console.error("사용법: send-friendtalk.ts --to <번호[,...]> --pfId <채널ID> --text <내용> [--image 경로] [--from 발신] [--disable-sms] [--dry-run]");
  process.exit(1);
}
if (!from) {
  console.error("❌ 발신번호 필요 (--from 또는 SOLAPI_SENDER).");
  process.exit(1);
}

const client = buildClient();

let imageId: string | undefined;
if (typeof a.image === "string") {
  const up = await client.uploadFile(a.image, "KAKAO"); // 친구톡 이미지는 KAKAO 타입
  imageId = up.fileId;
  console.log(`🖼  친구톡 이미지 업로드 완료 fileId=${imageId}`);
}

const kakaoOptions: any = { pfId };
if (imageId) kakaoOptions.imageId = imageId;
if (a["disable-sms"]) kakaoOptions.disableSms = true;

const message: any = {
  to: to.length === 1 ? to[0] : to,
  from,
  type: imageId ? "CTI" : "CTA",
  text,
  kakaoOptions,
};

if (a["dry-run"]) {
  console.log("🧪 DRY-RUN (실제 발송 안 함):");
  console.log(pretty(message));
  process.exit(0);
}

const res = await client.send(message);
console.log("✅ 친구톡 발송 요청 완료");
console.log(pretty(res.groupInfo?.count ?? res));
