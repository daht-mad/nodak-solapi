# 솔라피 메시지 타입 치트시트

`type` 필드에 넣는 코드. 보통은 `autoTypeDetect: true`로 자동 판별되지만, 알림톡/친구톡은 명시해야 함.

| 코드 | 뜻 | 언제 |
|------|-----|------|
| `SMS` | 단문 (~90byte, 한글 45자) | 짧은 문자 |
| `LMS` | 장문 (~2000byte) | 긴 문자. `subject`(제목) 넣으면 자동 LMS |
| `MMS` | 사진 문자 | `imageId` 있으면 자동 MMS (이미지는 먼저 uploadFile → MMS) |
| `ATA` | 알림톡 | 사전 승인 템플릿(`templateId`) + 채널(`pfId`) 필요. 정보성, 친구 아니어도 발송 |
| `CTA` | 친구톡(텍스트) | 채널 친구 대상, 광고성 |
| `CTI` | 친구톡(이미지) | 친구톡 + `imageId`(KAKAO 타입 업로드) |
| `RCS_*` | RCS | 잘 안 씀 |
| `FAX` / `VOICE` | 팩스/음성 | 잘 안 씀 |

## 발송 방식 3줄 요약
- 그냥 문자(SMS/LMS/MMS) → `send.ts` (자동 판별)
- 알림톡(템플릿) → `send-alimtalk.ts`
- 친구톡(채널 친구) → `send-friendtalk.ts`
- 수신자마다 내용 다름 → `send-many.ts` (JSON 배열)

## 인증 (SDK가 자동 처리)
`Authorization: HMAC-SHA256 apiKey=..., date=<ISO8601>, salt=<random>, signature=<HMAC-SHA256(date+salt, secret)>`
- 서버 시간 ±15분 이내만 허용 → 머신 시간 정확해야 함
- 우리는 공식 `solapi` SDK가 서명을 알아서 만들어줘서 신경 안 써도 됨

## 발신번호
`from`은 솔라피 콘솔에 **사전 등록·인증된 번호**만 가능. 기본값은 `SOLAPI_SENDER` 환경변수로.
