# Release Notes

WTS 업무일지 클라이언트의 버전별 변경 이력입니다.

---

## v0.5.0 (Unreleased) — 위젯 UX 개편

> 작업 중 (HEAD 기준 작업 트리)

### Improved
- **위젯 입력 폼 단순화**
  - 폼 상단에 **최근 사용 업무 chip** (최근 4개) 표시 — 클릭 한 번에 업무·유형·방법 자동 입력
  - **업무 검색창** 추가 — 입력 시 select가 펼쳐지며 실시간 필터링
  - **시간 빠른 선택 chip** (1h / 2h / 4h / 8h) — 클릭으로 즉시 시간 설정 (직접 입력 fallback 유지)
- **오늘 실적 카드 개선**
  - 카드 클릭 시 **수정 모드**로 폼 열림 (`resultApi.update` 호출, 저장 버튼 라벨 "수정"으로 표시)
  - **삭제 버튼 항상 표시** (휴지통 아이콘) + 확인 prompt 추가
  - 시간 표시를 더 크고 명확하게, 시작·종료 시각을 별도 줄로 분리
- 시간 포맷 helper(`fmtTime`)가 `'0900'`과 `'09:00'` 양쪽 입력을 모두 처리하도록 보강

### Internal
- `src/index.css`에 `.widget-chip`, `.widget-chip-active`, `.widget-card-clickable` 스타일 추가

---

## v0.4.0 — 주간보고 데이터 소스 정리 (2026-04-30)

### Fixed
- **주간 보고서 데이터 로딩 변경**: weekly 페이지가 `myJobs` 기반으로 동작하도록 수정
- **주차(Report Week) 컨벤션 변경**: 보고 주차 기준이 **금~목** 으로 통일됨
  - 주차 라벨은 해당 주의 월요일을 기준으로 `ceil(day/7)` 으로 산출

### Commits
- `f5f95df` fix: load weekly report from myJobs and use Fri-Thu report week

---

## v0.3.0 — 자동 로그인 / 세션 재인증 (2026-04-16)

### Added
- **자동 로그인** 옵션 (로그인 화면 체크박스)
  - 활성화 시 자격 증명을 `localStorage` 에 저장 (`wts_auto_login`, `wts_credentials`)
- **세션 만료 시 자동 재인증**
  - axios response interceptor에서 401 응답 감지 시 저장된 자격증명으로 자동 재로그인 후 원 요청 재시도
  - 재시도는 요청당 1회로 제한 (`_retried` 플래그)
  - 자동 로그인 비활성 또는 재로그인 실패 시 `#/login` 으로 리다이렉트

### Commits
- `0b9a981` feat: add auto-login with session re-authentication on 401

---

## v0.2.1 / v0.2.0 — Auto-update & Production Logging (2026-04-13)

### v0.2.1
#### Fixed
- API 클라이언트의 `no-explicit-any` ESLint 오류 수정 (`7877845`)

### v0.2.0
#### Added
- **자동 업데이트 (electron-updater)**
  - 앱 시작 시 GitHub Release(`gold-penguin/wts_client_app`) 확인
  - 새 버전 발견 시 백그라운드 다운로드 → 사용자에게 "지금 재시작 / 나중에" dialog 표시
  - `app.isQuitting = true` 후 `autoUpdater.quitAndInstall()` 호출로 종료-설치 흐름 유지
- **electron-log 기반 프로덕션 에러 로깅**
  - 메인 프로세스: `log.transports.file.maxSize = 5MB`, `errorHandler.startCatching()` 활성
  - 렌더러: preload(`wtsElectron.log.{error,warn,info}`) → IPC → main process 파일 로그로 통합
  - API client 응답 인터셉터가 모든 에러를 자동으로 로그로 전송

### Commits
- `462adba` feat: add auto-update via electron-updater
- `a922a7e` feat: add production error logging with electron-log
- `57dc3ef` chore: bump version to v0.2.1
- `7877845` fix: resolve eslint no-explicit-any error in api client

---

## v0.1.0 — CI / Auto-version 파이프라인 (2026-04-13)

### Added
- **GitHub Actions CI 파이프라인 3종**
  - `ci.yml`: PR/push 시 TypeScript 체크 + ESLint + 빌드 검증 (ubuntu-latest)
  - `version.yml`: main 푸시 시 커밋 메시지 분석(`feat:` / `fix:` / `BREAKING CHANGE`)으로 SemVer 자동 bump → 태그 → Windows에서 electron 패키징 → GitHub Release 자동 생성
  - `build.yml`: 수동 트리거(`workflow_dispatch`) 전용 빌드
- `chore:` 커밋은 버전 bump를 건너뜀
- `electron-builder` CI publish 비활성화 (Release 업로드는 별도 step에서 처리)

### Commits
- `3bba6b9` feat: add CI pipeline and auto version management
- `643497c` fix: disable electron-builder auto publish in CI
- `d3a929d` fix: version workflow allow-same-version and skip chore commits
- `aade252` fix: skip commit when package.json version unchanged

---

## Initial — 프로젝트 스캐폴드 (2026-04-13)

### Added
- React 19 + Vite 8 + TypeScript 5.9 + Tailwind v4 기반 SPA
- Electron 41 셸 (메인 윈도우 + 트레이 + Always-on-top 위젯)
- 전역 단축키: `Ctrl+Shift+W` (메인 토글), `Ctrl+Shift+D` (위젯 토글)
- 페이지: 실적 입력 / 업무 관리 / 주간 보고 / 고객사 / 팀 현황 / 관리 / 위젯 / 로그인
- API 클라이언트: 백엔드 `http://idc.mocomsys.com:9080/api` 연동, JWT(Bearer) 헤더 자동 첨부

### Commits
- `24143bd` Initial commit: WTS Client App
- `5c5f851` Initial commit

---

## Versioning Convention

이 프로젝트는 **Conventional Commits** 기반의 자동 SemVer를 따릅니다:

| 커밋 prefix | bump 결과 |
|---|---|
| `BREAKING CHANGE` 포함 | **major** (X.0.0) |
| `feat:` | **minor** (0.X.0) |
| `fix:` | **patch** (0.0.X) |
| `chore:` / `docs:` / 기타 | bump 없음 |

`main` 브랜치 푸시 시 `.github/workflows/version.yml` 이 자동으로 분석·태깅·릴리즈합니다.
