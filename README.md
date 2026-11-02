# Inline Encrypter (Nimbalyst)

Obsidian의 [Inline Encrypter](https://community.obsidian.md/plugins/inline-encrypter)를 Nimbalyst로 옮긴 확장입니다. 위키(마크다운) 페이지 본문에서 비밀번호나 API 키 **일부만** 암호화해 둡니다.

- 디스크의 `.md` 파일에는 **암호문만** 저장됩니다: `` `enc:v1:<salt>:<iv>:<ciphertext>` ``
- 편집기에서는 🔒 칩으로 보입니다. 클릭하고 passphrase를 입력하면 값을 보거나 복사할 수 있습니다.
- passphrase는 디스크에 저장하지 않습니다. **잃어버리면 복구할 수 없습니다.**

## 사용법

| 동작 | 방법 |
|---|---|
| 새 비밀 넣기 | `/Encrypt secret` → 값 입력 → (처음이면) passphrase 두 번 입력 |
| 선택한 텍스트 암호화 | 텍스트 선택 후 **Ctrl+Shift+E** |
| 보기 / 복사 | 🔒 칩 클릭 → 보기 · 복사 (30초 뒤 클립보드 자동 비움) |
| 값 수정 | 칩 열기 → 수정 |
| 암호화 해제 | 칩 열기 → 해제 (확인 후 평문으로 되돌림) |
| 즉시 잠그기 | `/Lock secrets` (10분 동안 사용하지 않으면 자동으로 잠김) |
| AI로 암호화 | 에이전트에 "이 비밀번호를 암호화해서 넣어줘"라고 요청 → `inline_encrypter.encrypt` 도구가 실행되고, passphrase는 앱의 대화상자에서 직접 입력 |

> AI 도구를 쓰면 **평문이 AI 대화 기록에 남습니다**. 민감한 값은 직접 `/Encrypt secret`로 넣는 것을 권합니다. 복호화하는 AI 도구는 일부러 만들지 않았습니다.

## 확정된 설계

- 저장 형식: 인라인 코드만 지원 (`` `enc:v1:...` ``)
- passphrase: 앱이 실행되는 동안 메모리에만 캐시하고, 10분 동안 쓰지 않으면 자동으로 잠깁니다. 캐시된 passphrase로 풀리지 않는 비밀을 만나면 다시 묻습니다.
- 표시: 팝오버에 마스킹해서 보여주고, 보기 / 복사 / 수정 / 해제 버튼을 둡니다.
- AI: 암호화 도구만 제공합니다 (`permissions.ai: true`).

### 암호화 (WebCrypto만 사용, 외부 라이브러리 없음)
- PBKDF2-SHA256 600,000회, 무작위 salt 16바이트 → AES-256-GCM, 무작위 IV 12바이트
- GCM 인증 태그로 틀린 passphrase와 데이터 변조를 감지합니다.
- `v1` 버전 접두사가 있어서 나중에 알고리즘을 바꿔도 하위 호환을 유지할 수 있습니다.

### 파일 구조
```
src/
  index.ts                         모듈 export (transformers, lexicalExtensions, slashCommandHandlers, aiTools)
  crypto.ts                        encrypt / decrypt (순수 함수)
  session.ts                       passphrase 메모리 캐시, 자동 잠금, 재시도
  PassphraseDialog.ts              DOM 모달 (passphrase, 비밀 값 입력)
  styles.css                       --nim-* 테마 변수 사용
  lexical/
    EncryptedInlineNode.tsx        DecoratorNode (token + 임시 평문)
    EncryptedChip.tsx              🔒 칩과 팝오버 UI
    EncryptedTransformers.ts       `enc:v1:...` ↔ 노드 마크다운 변환
    EncryptedLexicalExtension.ts   노드 등록, Ctrl+Shift+E
```
내장 Math 확장(`resources/extensions/math`)과 같은 패턴입니다.

## 빌드와 설치

1. Node.js 20 LTS 이상 설치: `winget install OpenJS.NodeJS.LTS`
2. Nimbalyst **Settings > Advanced > Extension Dev Tools** 켜기
3. 이 폴더에서 `npm install`
4. Nimbalyst 에이전트에게 "이 확장 빌드하고 설치해줘"라고 요청 (`extension_build` → `extension_install`)

## 상태와 테스트 체크리스트

빌드, 타입 체크, 암호화 단위 테스트(왕복·틀린 passphrase·변조·정규식)를 통과했습니다. `%APPDATA%\@nimbalyst\electron\extensions\com.nimbalyst.inline-encrypter`에 설치되어 있습니다. 편집기 안에서 확인할 항목:

- [x] 빌드와 타입 체크 (`npm run typecheck`)
- [ ] `/Encrypt secret` 실행 → 저장 → 파일을 다시 열었을 때 칩이 유지되는지 (마크다운 왕복 변환)
- [ ] 저장된 `.md` 원문에 `` `enc:v1:...` ``만 있는지
- [ ] 내장 인라인 코드 변환기보다 이 변환기가 우선 적용되는지 (칩 대신 코드 조각으로 보이면 정규식 우선순위 문제)
- [ ] 틀린 passphrase → 오류 문구가 표시되고 다시 묻는지
- [ ] Ctrl+Shift+E로 선택 영역 암호화, 취소하면 원래 텍스트로 돌아오는지
- [ ] 다크/라이트 테마에서 팝오버가 잘 보이는지
- [ ] AI 도구가 토큰을 반환하는지 (`extension_test_ai_tool`)

## 나중에 할 것
- [ ] 여러 줄 블록 암호화 (```` ```encrypted ````)
- [ ] 페이지 전체 비밀을 새 passphrase로 다시 암호화
- [ ] Windows DPAPI로 "이 PC에서 기억하기"
- [ ] 자동 잠금 시간을 설정에서 바꾸기
