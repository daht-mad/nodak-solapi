#!/usr/bin/env bun
// 발송 통계 조회 (기간별 성공·실패·타입별 건수 + 잔액/포인트)
//   bun run statistics.ts                                   # 최근 7일
//   bun run statistics.ts --start-date 2026-08-01 --end-date 2026-08-18
//   bun run statistics.ts --export stats.csv                # 일별 통계 CSV 저장
//   bun run statistics.ts --start-date 2026-08-01 --json    # 원본 JSON 그대로
import { buildClient, parseArgs, pretty } from "./lib/client";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const a = parseArgs(process.argv.slice(2));

// 기본 기간: 최근 7일 (오늘 포함)
const end = typeof a["end-date"] === "string" ? String(a["end-date"]) : ymd(new Date());
const start =
  typeof a["start-date"] === "string"
    ? String(a["start-date"])
    : ymd(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

const client = buildClient();
const res: any = await client.getStatistics({ startDate: start, endDate: end });

if (a.json) {
  console.log(pretty(res));
  process.exit(0);
}

// 일별 데이터 펼치기 (monthPeriod[].dayPeriod[])
const days: any[] = [];
for (const mp of res.monthPeriod ?? []) {
  for (const dp of mp.dayPeriod ?? []) days.push(dp);
}
days.sort((x, y) => String(x._id).localeCompare(String(y._id)));

console.log(`📊 발송 통계  ${start} ~ ${end}`);
// ⚠️ 통계 응답의 balance/point 는 "남은 돈"이 아니라 그 기간에 **쓴 금액**이다
// (일별 balance 합계와 일치). 남은 잔액은 balance.ts 로 따로 조회한다.
console.log(`💸 이 기간에 쓴 금액 ${res.balance ?? 0}원 / 포인트 ${res.point ?? 0}`);
console.log(`   (남은 잔액은 bun run scripts/balance.ts)`);
const t = res.total ?? {};
const s = res.successed ?? {};
const f = res.failed ?? {};
console.log(
  `합계 ${t.total ?? 0}건  (성공 ${s.total ?? 0} · 실패 ${f.total ?? 0})  ` +
    `SMS ${t.sms ?? 0} · LMS ${t.lms ?? 0} · MMS ${t.mms ?? 0} · 알림톡 ${t.ata ?? 0} · 친구톡 ${(t.cta ?? 0) + (t.cti ?? 0)}`,
);

if (days.length) {
  console.log("── 일별 ──");
  for (const d of days) {
    const dt = d.total ?? {};
    const ds = d.successed ?? {};
    const df = d.failed ?? {};
    console.log(
      `• ${d._id}  총 ${dt.total ?? 0}  (성공 ${ds.total ?? 0}/실패 ${df.total ?? 0})  쓴 금액 ${d.balance ?? ""}`,
    );
  }
}

// CSV export
if (typeof a.export === "string") {
  const header = "date,total,success,failed,sms,lms,mms,ata,cta,cti,spent,spent_point";
  const rows = days.map((d) => {
    const dt = d.total ?? {};
    const ds = d.successed ?? {};
    const df = d.failed ?? {};
    return [
      d._id,
      dt.total ?? 0,
      ds.total ?? 0,
      df.total ?? 0,
      dt.sms ?? 0,
      dt.lms ?? 0,
      dt.mms ?? 0,
      dt.ata ?? 0,
      dt.cta ?? 0,
      dt.cti ?? 0,
      d.balance ?? "",
      d.point ?? "",
    ].join(",");
  });
  await Bun.write(a.export, [header, ...rows].join("\n") + "\n");
  console.log(`💾 CSV 저장 완료: ${a.export} (${rows.length}행)`);
}
