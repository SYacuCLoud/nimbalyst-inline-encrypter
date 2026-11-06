# Inline Encrypter (Nimbalyst 확장)

위키(마크다운) 페이지 본문에서 비밀번호나 API 키 **일부만** 암호화해 두는 확장입니다.
Obsidian의 [Inline Encrypter](https://community.obsidian.md/plugins/inline-encrypter)를 Nimbalyst로 옮겼습니다.

## 주요 기능

- 디스크의 `.md` 파일에는 **암호문만** 저장됩니다: `` `enc:v1:<salt>:<iv>:<ciphertext>` ``
- 편집기에서는 🔒 칩으로 보입니다. 클릭하고 passphrase를 입력하면 값을 보거나 복사할 수 있습니다.
- passphrase는 디스크에 저장하지 않습니다. **잃어버리면 복구할 수 없습니다.**

## 설치

Windows 기준입니다. Node.js 20 LTS 이상이 필요합니다.

1. 저장소를 받고 빌드합니다.
   ```bash
   git clone https://github.com/SYacuCLoud/nimbalyst-inline-encrypter.git
   cd nimbalyst-inline-encrypter
   npm install
   npm run build
   ```
2. `manifest.json`과 `dist/`를 `%APPDATA%\@nimbalyst\electron\extensions\com.nimbalyst.inline-encrypter\`에 복사합니다.
3. Nimbalyst를 다시 시작합니다.

Nimbalyst **Settings > Advanced > Extension Dev Tools**를 켰다면 2~3 대신 `extension_build` / `extension_install`을 써도 됩니다.

## 사용법

| 동작 | 방법 |
|---|---|
| 새 비밀 넣기 | `/Encrypt secret` → 값 입력 → (처음이면) passphrase 두 번 입력 |
| 선택한 텍스트 암호화 | 텍스트 선택 후 **Ctrl+Shift+E** 또는 떠 있는 서식 툴바의 🔒 버튼 |
| 보기 / 복사 | 🔒 칩 클릭 → 보기 · 복사 (30초 뒤 클립보드 자동 비움) |
| 값 수정 | 칩 열기 → 수정 |
| 암호화 해제 | 칩 열기 → 해제 (확인 후 평문으로 되돌림) |
| 즉시 잠그기 | `/Lock secrets` (10분 동안 사용하지 않으면 자동으로 잠김) |
| AI로 암호화 | 에이전트에 "이 비밀번호를 암호화해서 넣어줘"라고 요청 → `inline_encrypter.encrypt` 도구가 실행되고, passphrase는 앱의 대화상자에서 직접 입력 |

> AI 도구를 쓰면 **평문이 AI 대화 기록에 남습니다**. 민감한 값은 직접 `/Encrypt secret`로 넣는 것을 권합니다. 복호화하는 AI 도구는 일부러 만들지 않았습니다.

## 보안 설계

- 키 유도: PBKDF2-SHA256 600,000회, 무작위 salt 16바이트
- 암호화: AES-256-GCM, 무작위 IV 12바이트. 인증 태그로 틀린 passphrase와 데이터 변조를 감지합니다.
- WebCrypto만 사용하며 외부 라이브러리는 없습니다.
- passphrase는 앱이 실행되는 동안 메모리에만 캐시하고, 10분 동안 쓰지 않으면 자동으로 잠깁니다. 캐시된 passphrase로 풀리지 않는 비밀을 만나면 다시 묻습니다.
- `v1` 접두사가 있어 나중에 알고리즘을 바꿔도 하위 호환을 유지할 수 있습니다.

## 제한

- 저장 형식은 인라인 코드(`` `enc:v1:...` ``)만 지원합니다.
- AI 도구는 암호화만 제공합니다(`permissions.ai: true`).

## 로드맵

- 여러 줄 블록 암호화
- 페이지 전체 비밀을 새 passphrase로 다시 암호화
- Windows DPAPI로 "이 PC에서 기억하기"
- 자동 잠금 시간을 설정에서 바꾸기

## 개발

```
src/
  index.ts                         모듈 export
  crypto.ts                        encrypt / decrypt
  session.ts                       passphrase 메모리 캐시, 자동 잠금
  PassphraseDialog.ts              passphrase·비밀 값 입력 모달
  lexical/                         칩 노드, 마크다운 변환, Ctrl+Shift+E
```

Nimbalyst 공식 확장이 아닌 개인 프로젝트입니다.
