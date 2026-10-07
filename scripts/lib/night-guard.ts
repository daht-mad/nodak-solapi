// 야간 발송 차단 가드 — 모든 발송이 지나는 관문
//
// 왜: 조회만 하려던 스크립트가 실수로 실행돼 새벽에 안내문자가 승인 없이 나간 적이 있다.
//     "실수로 도는 것"은 계속 막을 수 없으니, 도는 시각을 막는다.
//
// 정책: KST 21:00~08:00 발송 차단. 낮(08:00~21:00)은 그대로 통과.
// 예외: ALLOW_NIGHT_SEND=1 또는 --allow-night 플래그 (주인이 "지금 보내" 한 경우만).
//
// 어디에 걸리나: lib/client.ts 의 buildClient() 가 돌려주는 클라이언트의 send()를
//   감싸므로, send.ts / send-many.ts / send-alimtalk.ts / send-friendtalk.ts 전부 커버된다.

const NIGHT_START = 21; // 21시부터
const NIGHT_END = 8; // 8시 전까지

/** 지금이 KST 기준 야간인가 */
export function isNightKST(now: Date = new Date()): boolean {
  const kstHour = new Date(now.getTime() + 9 * 3600e3).getUTCHours();
  return kstHour >= NIGHT_START || kstHour < NIGHT_END;
}

/** 현재 KST 시각 문자열 (로그용) */
export function kstNow(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600e3)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

/** 오버라이드가 켜져 있는가 (env 또는 --allow-night) */
export function nightOverridden(): boolean {
  return (
    process.env.ALLOW_NIGHT_SEND === "1" ||
    process.argv.includes("--allow-night")
  );
}

/** 수신번호 마스킹 (뒤 3자리만 남김) */
function mask(v: unknown): string {
  if (Array.isArray(v)) return `${v.length}명`;
  return String(v ?? "").replace(/.(?=.{3})/g, "*");
}

/**
 * 발송 직전 호출. 야간이고 오버라이드가 없으면 프로세스를 종료한다.
 * (스크립트 CLI 특성상 반환값을 무시당하지 않게 여기서 끊는다)
 */
export async function assertSendAllowed(messages: unknown): Promise<void> {
  if (!isNightKST()) return;

  if (nightOverridden()) {
    console.log(`🌙 야간이지만 오버라이드가 켜져 있어 통과 (${kstNow()} KST)`);
    return;
  }

  const list = Array.isArray(messages) ? messages : [messages];
  console.error(
    `\n🌙 야간 발송 차단 — ${kstNow()} KST\n` +
      `   허용 시간은 ${NIGHT_END}시~${NIGHT_START}시야. 지금은 보낼 수 없어.\n` +
      `   대상: ${list.length}건 (첫 수신: ${mask((list[0] as any)?.to)})\n` +
      `   꼭 지금 보내야 하면 --allow-night 를 붙이거나 ALLOW_NIGHT_SEND=1 로 다시 실행해줘.\n`,
  );
  process.exit(1);
}

/** 클라이언트의 send()를 야간 가드로 감싼다. */
export function wrapWithNightGuard<T extends { send: (...a: any[]) => any }>(
  client: T,
): T {
  const originalSend = client.send.bind(client);
  (client as any).send = async (...args: any[]) => {
    await assertSendAllowed(args[0]);
    return originalSend(...args);
  };
  return client;
}
