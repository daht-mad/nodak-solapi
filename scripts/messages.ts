#!/usr/bin/env bun
// 발송 내역/상태 조회 (성공·실패·잔여 확인)
//   bun run messages.ts                 # 최근 발송 건
//   bun run messages.ts --limit 50
//   bun run messages.ts --to 01012345678
//   bun run messages.ts --limit 200 --export messages.csv   # CSV로 저장
import { buildClient, parseArgs, pretty } from "./lib/client";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const a = parseArgs(process.argv.slice(2));
const client = buildClient();

const query: any = {};
if (a.limit) query.limit = Number(a.limit);
if (typeof a.to === "string") query.to = a.to;
if (typeof a.status === "string") query.status = a.status;

const res: any = await client.getMessages(Object.keys(query).length ? query : undefined);

const list: any[] = res.messageList
  ? Object.values(res.messageList)
  : res.list ?? [];
console.log(`📨 발송 내역 ${list.length}건`);
for (const m of list.slice(0, Number(a.limit) || 20)) {
  console.log(
    `• ${m.dateCreated ?? ""}  ${m.type ?? ""}  to=${m.to ?? ""}  status=${m.statusCode ?? m.status ?? ""}  ${m.statusMessage ?? ""}`,
  );
}
if (list.length === 0) console.log(pretty(res));

// CSV export (조회된 전체 내역 저장)
if (typeof a.export === "string") {
  const header = "dateCreated,type,from,to,statusCode,statusMessage,messageId";
  const rows = list.map((m) =>
    [
      m.dateCreated,
      m.type,
      m.from,
      m.to,
      m.statusCode ?? m.status,
      m.statusMessage,
      m.messageId ?? m._id,
    ]
      .map(csvCell)
      .join(","),
  );
  await Bun.write(a.export, [header, ...rows].join("\n") + "\n");
  console.log(`💾 CSV 저장 완료: ${a.export} (${rows.length}행)`);
}
