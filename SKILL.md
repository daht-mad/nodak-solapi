---
name: nodak-solapi
description: 솔라피(Solapi) 문자·카카오 발송 툴킷. SMS/LMS/MMS·알림톡·친구톡·대량발송·잔액·발송내역·템플릿 조회를 스크립트 한 줄로 처리하고, 처음 쓰면 셋업(키 발급·.env 입력·연결 시험)을 한 단계씩 안내한다. "문자 보내줘", "솔라피", "알림톡", "LMS 발송", "친구톡", "발송 잔액", "솔라피 셋업", "solapi" 등을 언급할 때 사용.
---

# nodak-solapi

솔라피로 문자·알림톡을 보내는 스킬. 공식 `solapi` SDK를 얇게 감쌌고, 사람이 실수하기 쉬운 곳(번호 표기·깨지는 글자·요일 오기·한밤중 발송)은 발송 직전에 자동으로 막는다.

> 아래 명령은 전부 **이 스킬 폴더에서** 실행한다 (`cd <이 폴더>`). 그래야 `.env`를 자동으로 읽는다.

## ⓪ 처음이면 여기부터 — 셋업

**발송 요청을 받았는데 셋업이 안 돼 있으면 발송보다 셋업이 먼저다.** 아래를 돌려서 상태부터 본다.

```bash
bun run scripts/setup.ts
```

이 스크립트가 알아서 하는 것: 의존성 설치 → `.env` 빈 틀 만들기 → 값이 채워졌는지 확인(값은 안 찍음) → 잔액 조회로 연결 시험 → 허용 IP 문제면 이 컴퓨터 공인 IP 찾아주기.

종료코드로 다음 행동을 정한다:
- `0` — 끝. 주인 번호로 시험 문자 1통 제안 (번호는 주인에게 확인받고, `--dry-run` 먼저)
- `2` — **사람 차례.** 출력에 나온 할 일을 주인에게 그대로 전한다. 키 발급이 필요하면 `references/setup-guide.md`를 읽고 **한 단계씩** 안내한다 (한 번에 다 던지지 않기)
- `1` — 오류. 출력 원문을 주인에게 보여준다

### 🔑 키는 파일에만 — 봇이 지킬 것

- `setup.ts`가 `.env`를 주인 컴퓨터의 편집기로 **열어준다.** 주인은 거기에 붙여넣고 저장만 하면 된다
- **키·시크릿을 채팅·DM으로 달라고 하지 않는다.** 주인이 채팅에 붙여넣었으면 받아 쓰지 말고, "대화 기록에 남았으니 솔라피에서 그 키를 지우고 새로 만들자"고 안내한다
- 키 값을 화면·로그·메시지에 찍지 않는다. 확인은 `setup.ts`처럼 "채워짐/비어 있음"으로만
- `.env`는 깃에 올리지 않는다 (`.gitignore`에 들어 있음)

## 1. 문자 발송 (SMS / LMS / MMS — 자동 판별)

```bash
bun run scripts/send.ts --to 01012345678 --text "안녕하세요"            # 짧으면 SMS
bun run scripts/send.ts --to 01011112222,01033334444 --text "공지입니다"  # 여러 명 같은 내용
bun run scripts/send.ts --to 010... --subject "안내" --text "긴 내용..."   # 제목 있으면 LMS
bun run scripts/send.ts --to 010... --text "포스터 첨부" --image ./poster.jpg  # 사진 있으면 MMS
```
**항상 `--dry-run` 먼저** 붙여서 내용·수신자 수를 확인하고, 이상 없으면 떼고 실제 발송.

## 2. 알림톡 (ATA) — 카카오 승인 템플릿

```bash
bun run scripts/templates.ts                   # 템플릿/채널 ID 확인
bun run scripts/templates.ts --name 수강안내
bun run scripts/send-alimtalk.ts \
  --to 01012345678 --pfId KA01PF... --templateId KA01TP... \
  --variables '{"#{이름}":"홍길동","#{날짜}":"8/20"}' \
  --text "홍길동님 안내드립니다..." --dry-run
```
- 기본은 실패 시 문자 대체발송 **안 함**. 대신 보내려면 `--fallback`
- `variables` 키는 템플릿의 `#{...}` 그대로

## 3. 친구톡 (CTA / CTI) — 채널 친구 대상, 광고성

```bash
bun run scripts/send-friendtalk.ts --to 010... --pfId KA01PF... --text "이번주 소식"
bun run scripts/send-friendtalk.ts --to 010... --pfId KA01PF... --text "..." --image ./card.jpg
```

## 4. 대량 발송 (수신자마다 내용 다름)

```bash
# messages.json = [{"to":"010...","text":"홍길동님..."}, {"to":"010...","text":"김철수님..."}]
bun run scripts/send-many.ts --file messages.json --dry-run
bun run scripts/send-many.ts --file messages.json
```
`from`을 비우면 `SOLAPI_SENDER`로 채운다.

## 5. 유틸

```bash
bun run scripts/balance.ts                                   # 남은 잔액 (statistics의 금액은 "쓴 돈"이니 혼동 금지)
bun run scripts/messages.ts                                  # 발송 내역/상태
bun run scripts/messages.ts --to 010...
bun run scripts/messages.ts --limit 200 --export messages.csv
bun run scripts/statistics.ts                                # 최근 7일 요약 (건수 + 쓴 금액)
bun run scripts/statistics.ts --start-date 2026-08-01 --end-date 2026-08-18 --export stats.csv
bun run scripts/upload-image.ts --file ./x.jpg               # MMS용 fileId
bun run scripts/upload-image.ts --file ./x.jpg --type KAKAO  # 친구톡용
```

## 발송 전 체크 (돈 나가고, 회수 안 됨 ⚠️)

1. **수신번호를 손으로 다시 타이핑하지 않는다** — 아래 참조
2. `--dry-run`으로 내용·수신자 수 확인. `to=`를 원본 명단과 대조
3. 대량이면 주인 번호로 1건 먼저 → 확인 후 전체
4. **주인 승인 없이 남에게 보내지 않는다.** 보낼 내용·대상을 보여주고 "보내"를 받은 뒤 발송

### 🚨 수신번호는 조회한 값을 그대로 넘긴다

번호를 눈으로 읽고 다시 적는 구간에서 사고가 난다. 조회가 정확해도 여기서 틀린다.

```bash
# ✅ 조회값이 사람 눈을 거치지 않고 인자로 간다
read -r TO NAME <<< "$(... 명단 조회 ... | python3 -c '...print(tel, name)')"
bun run scripts/send.ts --to "$TO" --text "..."
```
- ❌ 화면에 마스킹해 찍은 값(`010****1234`)의 가운데를 채워서 쓰기
- ❌ 스크립트 파일에 번호 하드코딩 (명단은 보낼 때마다 다시 조회)
- "나한테 보내봐"라도 **번호를 먼저 채팅에 적어 확인받는다.** 번호가 틀리면 그게 곧 개인정보 유출이다

## 🌙 야간 발송 차단 (항상 켜져 있음)

**한국시간 21:00~08:00에는 발송이 막힌다.** `--dry-run`은 밤에도 된다.
꼭 지금 보내야 하면 `--allow-night` (또는 `ALLOW_NIGHT_SEND=1`) — **주인이 "지금 보내"라고 했을 때만.** 봇 판단으로 붙이지 않는다.

> 실수로 스크립트가 돌아서 새벽에 문자가 나가는 사고를 막으려고 **도는 시각**을 막는다.

## 자동 게이트 (항상 켜져 있음)

`send.ts` / `send-many.ts`는 발송 직전(`--dry-run` 포함)에 세 가지를 검사한다. 로직은 `scripts/lib/sanitize.ts`.

1. **번호 정규화** — `+82`·하이픈·공백이 붙어 와도 국내 표기 숫자만 남긴다. 0으로 시작 안 하거나 자릿수가 이상하면 **발송 중단**
2. **깨질 글자** — 문자는 한국 휴대폰 글자표(CP949)에 있는 글자만 안전하다. 이모지·`▪`·`◾`·`—`는 받는 폰에서 깨진다. 하나라도 있으면 **발송 중단** + 어떤 글자인지 알려줌
   - 안전한 기호: `■ □ ● ○ ◆ ◇ ★ ☆ ▲ ▶ ◎ ※ ·`
   - 웃음·아쉬움은 `ㅎㅎ`·`ㅠㅠ`로 (통과함)
3. **요일 오기** — 본문의 `9/18(목)` 같은 표기를 실제 달력과 대조. 틀리면 **발송 중단**
   ```
   ❌ 요일 오기: 9/18(목) → 2026-09-18은 금요일이야 (목 아님)
   ```

알고도 강행할 땐 `--force` (경고는 그대로 남음). 걸렸다는 건 대개 진짜 틀렸다는 뜻이니 고치는 게 먼저다.
회귀 시험: `bun run tests/weekday-gate.test.ts`

## 참고
- 첫 연결 가이드: `references/setup-guide.md`
- 메시지 타입 코드: `references/message-types.md`
- 공식문서: https://developers.solapi.com · SDK: https://github.com/solapi/solapi-nodejs
