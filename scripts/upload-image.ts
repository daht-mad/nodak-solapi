#!/usr/bin/env bun
// 이미지 업로드 → fileId 획득 (MMS 사진 / 친구톡 이미지용)
//   bun run upload-image.ts --file ./poster.jpg              # MMS용 (기본)
//   bun run upload-image.ts --file ./card.jpg --type KAKAO   # 친구톡용
// 얻은 fileId를 메시지의 imageId 로 넣으면 됨.
import { buildClient, parseArgs } from "./lib/client";

const a = parseArgs(process.argv.slice(2));
const file = a.file as string;
const type = (a.type as string) || "MMS"; // MMS | KAKAO | RCS | DOCUMENT ...
if (!file) {
  console.error("사용법: upload-image.ts --file <경로> [--type MMS|KAKAO]");
  process.exit(1);
}

const client = buildClient();
const res = await client.uploadFile(file, type as any);
console.log(`✅ 업로드 완료`);
console.log(`fileId: ${res.fileId}`);
