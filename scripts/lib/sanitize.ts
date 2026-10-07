// 발송 직전 게이트 — 번호 정규화 + 문자 깨짐 검사.
// 왜: 소스(에어테이블/시트/수기)마다 번호 표기가 제각각이고(+82, 하이픈, 공백),
//     문자는 CP949(완성형)만 안전한데 이모지·▪·— 같은 글자가 섞이면 수신폰에서 깨진다.
//     테이블마다 포뮬러 필드를 만드는 대신 "발송 직전 한 곳"에서 막는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** +82·하이픈·공백·괄호 뭐가 붙어와도 국내 발송용 숫자만 남긴다. */
export function normalizePhone(raw: unknown): { ok: boolean; value: string; reason?: string } {
  const orig = String(raw ?? "").trim();
  let d = orig.replace(/[^\d+]/g, "");

  // 국제표기 → 국내표기 (+82 10 1234 5678 → 01012345678)
  if (d.startsWith("+82")) d = "0" + d.slice(3);
  else if (d.startsWith("82") && d.length >= 11) d = "0" + d.slice(2);
  d = d.replace(/\D/g, "");
  d = d.replace(/^00+/, "0"); // +820 10... 같은 이중 0 방어

  if (!d) return { ok: false, value: orig, reason: "숫자가 없음" };
  if (!d.startsWith("0")) return { ok: false, value: d, reason: "0으로 시작하지 않음" };
  // 휴대폰 10~11자리 / 유선 9~11자리
  if (d.length < 9 || d.length > 11) return { ok: false, value: d, reason: `자릿수 이상(${d.length}자리)` };
  return { ok: true, value: d };
}

let CHARSET: Set<string> | null = null;
function charset(): Set<string> {
  if (!CHARSET) {
    const p = join(import.meta.dir, "..", "..", "references", "cp949-charset.txt");
    CHARSET = new Set([...readFileSync(p, "utf-8")]);
  }
  return CHARSET;
}

/** 수신폰에서 깨질 글자(CP949 미지원)를 찾아낸다. 줄바꿈·탭은 통과. */
export function findUnsupportedChars(text: string): { char: string; code: string }[] {
  const cs = charset();
  const bad = new Map<string, string>();
  for (const ch of text) {
    if (ch === "\n" || ch === "\r" || ch === "\t") continue;
    if (!cs.has(ch)) bad.set(ch, "U+" + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"));
  }
  return [...bad].map(([char, code]) => ({ char, code }));
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

/**
 * 본문의 `M/D(요일)` 표기가 실제 요일과 맞는지 검사한다.
 * 연도는 안 적히므로 "오늘 기준 가장 가까운 해"로 해석한다(±6개월 밖이면 이웃 해).
 * 2026-09-01 사고: 9/18(목)~9/21(일)로 12명에게 나감. 실제는 금~월.
 */
export function findWrongWeekdays(
  text: string,
  today: Date = new Date(),
): { token: string; written: string; actual: string; date: string }[] {
  const out: { token: string; written: string; actual: string; date: string }[] = [];
  const re = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\(\s*([월화수목금토일])\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [token, mm, dd, written] = m;
    const month = Number(mm), day = Number(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    let best: Date | null = null;
    for (const y of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const d = new Date(y, month - 1, day);
      if (d.getMonth() !== month - 1 || d.getDate() !== day) continue; // 2/30 같은 없는 날짜
      if (!best || Math.abs(d.getTime() - today.getTime()) < Math.abs(best.getTime() - today.getTime())) best = d;
    }
    if (!best) continue;

    const actual = WEEKDAYS[(best.getDay() + 6) % 7];
    if (actual !== written) {
      const iso = `${best.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      out.push({ token, written, actual, date: iso });
    }
  }
  return out;
}

/**
 * 메시지 배열을 발송 직전에 손본다.
 * - to 는 정규화해서 덮어씀 (바뀐 건 로그로 보여줌)
 * - 깨질 글자·불량 번호가 있으면 목록을 돌려줌 (호출부가 중단 결정)
 */
export function sanitizeMessages(messages: any[]): {
  fixed: { before: string; after: string }[];
  badPhones: { to: string; reason: string }[];
  badChars: { char: string; code: string }[];
  wrongWeekdays: { token: string; written: string; actual: string; date: string }[];
} {
  const fixed: { before: string; after: string }[] = [];
  const badPhones: { to: string; reason: string }[] = [];
  const badCharMap = new Map<string, string>();
  const weekdayMap = new Map<string, { token: string; written: string; actual: string; date: string }>();

  for (const m of messages) {
    const tos = Array.isArray(m.to) ? m.to : [m.to];
    const out: string[] = [];
    for (const t of tos) {
      const r = normalizePhone(t);
      if (!r.ok) badPhones.push({ to: String(t), reason: r.reason! });
      else {
        if (r.value !== String(t)) fixed.push({ before: String(t), after: r.value });
        out.push(r.value);
      }
    }
    if (out.length) m.to = Array.isArray(m.to) ? out : out[0];

    for (const field of ["text", "subject"] as const) {
      if (typeof m[field] === "string") {
        for (const b of findUnsupportedChars(m[field])) badCharMap.set(b.char, b.code);
        for (const w of findWrongWeekdays(m[field])) weekdayMap.set(w.token, w);
      }
    }
  }
  return {
    fixed,
    badPhones,
    badChars: [...badCharMap].map(([char, code]) => ({ char, code })),
    wrongWeekdays: [...weekdayMap.values()],
  };
}

/** 게이트 결과를 사람이 읽게 출력하고, 막아야 하면 true 를 돌려준다. */
export function reportAndShouldBlock(
  r: ReturnType<typeof sanitizeMessages>,
  force: boolean,
): boolean {
  for (const f of r.fixed) console.log(`🔧 번호 정규화 ${f.before} → ${f.after}`);
  if (r.badChars.length) {
    const list = r.badChars.map((b) => `${b.char}(${b.code})`).join(" ");
    console.error(`⚠️  수신폰에서 깨질 글자 ${r.badChars.length}종: ${list}`);
    console.error("   문자는 CP949(완성형)만 안전해. 안전한 기호: ■ □ ● ○ ◆ ◇ ★ ☆ ▲ ▶ ◎ ※ ·");
  }
  if (r.badPhones.length) {
    for (const p of r.badPhones) console.error(`❌ 번호 이상: ${p.to} (${p.reason})`);
  }
  if (r.wrongWeekdays.length) {
    for (const w of r.wrongWeekdays)
      console.error(`❌ 요일 오기: ${w.token} → ${w.date}은 ${w.actual}요일이야 (${w.written} 아님)`);
  }
  const bad = r.badChars.length > 0 || r.badPhones.length > 0 || r.wrongWeekdays.length > 0;
  if (bad && !force) {
    console.error("🛑 발송 중단. 고치거나, 알고도 강행하려면 --force 를 붙여줘.");
    return true;
  }
  if (bad && force) console.error("⚠️  --force 라서 그대로 발송함.");
  return false;
}
