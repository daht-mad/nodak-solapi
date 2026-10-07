import { findWrongWeekdays, sanitizeMessages, reportAndShouldBlock } from "../scripts/lib/sanitize";
const today = new Date(2026, 8, 1); // 2026-09-01
let pass = 0, fail = 0;
function t(name: string, cond: boolean) { cond ? pass++ : fail++; console.log((cond ? "PASS " : "FAIL ") + name); }

// 1) 실제 사고 문장 — 잡아야 함
const bad = findWrongWeekdays("일정은 9/18(목)~9/21(일)이에요", today);
t("사고 문장 2건 검출", bad.length === 2);
t("9/18 → 금", bad[0]?.actual === "금" && bad[0]?.written === "목");
t("9/21 → 월", bad[1]?.actual === "월" && bad[1]?.written === "일");

// 2) 정정본 — 통과해야 함
t("정정본 무검출", findWrongWeekdays("9/18(금)~9/21(월), 금토일월 3박 4일", today).length === 0);

// 3) 요일 표기 없음 — 무관
t("요일 없으면 무검출", findWrongWeekdays("9/18~9/21 진행해요", today).length === 0);

// 4) 없는 날짜는 건너뜀
t("2/30 무시", findWrongWeekdays("2/30(월)", today).length === 0);

// 5) 공백 변형도 잡음
t("공백 변형 검출", findWrongWeekdays("9 / 18 ( 목 )", today).length === 1);

// 6) 게이트가 실제로 막는지
const msgs = [{ to: "01012345678", text: "9/18(목) 시작" }];
const r = sanitizeMessages(msgs);
t("sanitize가 요일 오기 수집", r.wrongWeekdays.length === 1);
t("force 없으면 차단", reportAndShouldBlock(r, false) === true);
t("force면 통과", reportAndShouldBlock(r, true) === false);

// 7) 정상 메시지는 안 막음
const ok = sanitizeMessages([{ to: "01012345678", text: "9/18(금) 시작" }]);
t("정상 메시지 통과", reportAndShouldBlock(ok, false) === false);

console.log(`\n검사 대상 ${pass + fail}건 · PASS ${pass} / FAIL ${fail}`);
if (fail) process.exit(1);
