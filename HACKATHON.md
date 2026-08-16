# 해커톤 당일 치트시트

## 시작 폴더

```
cd ~/projects/hackathon-starter
```

## 0. 심사 기준 (오프닝 슬라이드)

**가장 크게 보는 세 가지**

1. **문제와 차별성** — 무엇을 왜 제출하는가 / 어떻게 다른가
2. **작동하는 제품** — 핵심 흐름이 실제로 작동하는가
3. **GPT-Codex Build Orchestration** — AI와 함께 어떻게 만들었는가

\+ 사용자 가치 · 경험 · 팀 협업 · 통합

**3번이 요구하는 것: "AI 사용량이 아니라, 함께 일한 방식을 보여주세요."**

| 축 | 질문 |
|---|---|
| **PLAN** | 무엇을 사람과 AI에게 맡겼는가 |
| **PARALLEL** | 네 명의 작업을 어떻게 병렬화했는가 |
| **REVIEW** | 결과를 어떻게 검토하고 고쳤는가 |
| **INTEGRATE** | 각자의 작업을 어떻게 하나로 합쳤는가 |

1·2번은 데모로 증명된다. **3번만 증거를 따로 남겨야 한다** — 그게 아래 1·2절이다.

## 1. 회의 실시간 전사 켜기

팀 배정 직후, 터미널 탭 하나를 열고:

```bash
uv run --project ~/projects/sttskill stt stream -o meeting.md
```

- 마이크에서 30초 청크로 녹음 → mlx-whisper 전사 → `meeting.md`에 이어붙임
- 중지: Ctrl+C (마지막 청크까지 처리 후 종료)
- 청크를 짧게: `--chunk 15` (반응 빠르지만 정확도 약간 떨어짐)
- 장치 확인: `uv run --project ~/projects/sttskill stt stream --list-devices`

**동시에 폰이나 QuickTime으로 통짜 녹음도 걸어둔다.** stream 모드는 화자 구분을
하지 않는다(`**[HH:MM]** 텍스트`만 남는다). 화자 구분된 인용문은 코드 프리즈
후에 파일 모드로 뽑는다 — 최대 4명, 팀 인원과 정확히 맞는다.

```bash
uv run --project ~/projects/sttskill stt ~/녹음/hackathon.m4a
```

**국면 표시는 하지 않는다.** 4축 경계는 16:45에 사후 추론한다 — git이 이미
객관적으로 기록하고 있다(5절).

한 가지만 습관 들이면 좋다: **이름을 부르는 것**("한이 API 맡아"). stream에
화자 구분이 없어서, 이름이 불리면 누가 뭘 맡았는지 전사만으로 복원된다.
안 해도 폰 녹음 화자 분리로 복구되니 강제는 아니다.

## 1-2. Codex 내역 모으기

Codex 로그는 **각자 자기 맥에만** 쌓인다. 팀 공유 대시보드는 없다.

| 경로 | 내용 |
|---|---|
| `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | 전체 대화 + 도구 호출. 첫 줄 `session_meta.cwd`로 레포 필터 가능 |
| `~/.codex/history.jsonl` | 사람이 친 프롬프트만 (`session_id`, `ts`, `text`) |
| `~/.codex/session_index.jsonl` | 세션 제목 목록 |

본인 것 훑어보기는 `codex resume`. **남의 것은 그 사람이 뽑아서 커밋해야만 보인다.**

**팀원 4명 전원이 16:30에 각자 실행:**

```bash
./scripts/codex-log.sh          # 오늘 이 레포에서 돌린 Codex 세션만 추출
git add docs/build-log/ && git commit -m "codex log: $(git config user.name)"
```

`docs/build-log/codex-<이름>-<날짜>.md`가 생긴다. 시스템 주입 블록은 걸러지고
**사람이 Codex에게 시킨 프롬프트만 시각과 함께** 남는다 — 그게 PLAN·REVIEW의 증거다.
(`jq` 필요: `brew install jq`)

## 2. CC에 회의 내용 반영해서 작업 시키기

```
meeting.md 읽고 brainstorming 해줘
```

```
방금 회의 내용 반영해서 [기능] 만들어줘
```

CC가 `meeting.md`를 읽으면 그 시점까지의 회의 맥락을 파악하고 작업한다.

## 3. 개발 시작

```bash
# .env.local에 체크인 후 받은 API 키 입력
npm run dev          # localhost:3000
```

Vercel 배포:
1. https://vercel.com/new → Import Git Repository
2. `git push`하면 자동 배포

## 4. Superpowers 순서

| 시점 | 명령 | 용도 |
|------|------|------|
| 10:10 | `/brainstorming` | 아이디어 구체화 |
| 11:00 | `/writing-plans` | MVP 구현 계획 |
| 11:30 | `/subagent-driven-development` | 병렬 빌드 |
| 버그 | `/systematic-debugging` | 5분 이상 막힐 때 |
| 16:00 | `/verification-before-completion` | 제출 전 검증 |

## 5. Codex Build Log 만들기 (16:45)

세 소스를 **시각으로 조인**한다. `meeting.md`도 `codex-*.md`도 `git log`도 전부
벽시계 시각이 붙어 있어서 그냥 붙는다.

```bash
./scripts/codex-log.sh                                    # 팀원 4명 각자
uv run --project ~/projects/sttskill stt ~/녹음/hackathon.m4a   # 화자 구분 회의록
```

### 4축 경계는 git이 이미 기록해뒀다

말로 표시할 필요가 없다. 이 신호들로 사후 추론한다.

| 축 | 어디서 나오나 |
|---|---|
| **PLAN** | 첫 커밋 **이전**의 `meeting.md` 구간 + 각자의 첫 Codex 프롬프트(무엇을 위임했는지) |
| **PARALLEL** | `git log --all` 에서 **저자별 커밋 시각대가 겹치는 구간** — 동시에 다른 파일을 만졌다는 물증 |
| **REVIEW** | Codex 프롬프트 직후 같은 파일을 고친 커밋. 회의록에서 그 시각 앞뒤 발화 = 왜 고쳤는지 |
| **INTEGRATE** | **머지 커밋**(`git log --merges`)과 그 직전 회의록 |

```bash
git log --all --format='%h %ad %an %d %s' --date=format:'%H:%M' --graph
git log --merges --format='%h %ad %an %s' --date=format:'%H:%M'
```

그다음 CC에 던진다:

```
meeting.md, docs/build-log/codex-*.md, git log --all --graph 을 시각으로 대조해서
PLAN / PARALLEL / REVIEW / INTEGRATE 4축 Build Log 초안 써줘.

국면 경계는 네가 찾아라:
- PLAN = 첫 커밋 이전 구간
- PARALLEL = 저자별 커밋 시각대가 겹치는 구간
- REVIEW = Codex 프롬프트 직후 같은 파일을 고친 커밋
- INTEGRATE = 머지 커밋과 그 직전 회의록

각 축마다 회의록 직접 인용 1개 + Codex 프롬프트 1개 + 커밋 해시 1개를 근거로 붙여.
```

**목표 형태** — 축마다 `인용 + 해시` 한 쌍:

```markdown
### REVIEW
> [13:42] "Codex가 만든 파서가 빈 배열에서 터진다. 엣지케이스 테스트부터 쓰자"

Codex 재위임 [13:45] "빈 배열/널 케이스 테스트 먼저 쓰고 파서 고쳐줘"
→ `a3f9c1` (13:51, 9분)
```

"AI를 많이 썼다"가 아니라 **"AI가 틀렸고 사람이 잡았다"**를 시각과 함께 보여주는 것.
슬라이드가 요구하는 게 정확히 이거다.

## 6. 제출물 체크리스트 (17:30 마감)

- [ ] 동작하는 MVP (배포 URL)
- [ ] GitHub 저장소 (README.md 빈칸 채우기)
- [ ] 데모 영상 (핵심 흐름 1개)
- [ ] Codex Build Log (Codex 위임→결과→수정 루프 기록) — 5절
- [ ] Value & Viability (대상 사용자, 기대 가치, 발전 방향)

## 7. 시간 경계선

| 시각 | 할 일 |
|---|---|
| 팀 배정 직후 | `stt stream` 켜기 + 통짜 녹음 시작. **이후 하루 종일 안 건드린다** |
| 10:10 | `/brainstorming` |
| 11:00 | 스켈레톤 완성 (입력→출력 1개 동작) |
| 낮 내내 | 각자 작업. 기록을 위해 따로 할 일 **없음** |
| 16:30 | 코드 프리즈. 팀원 전원 `./scripts/codex-log.sh` + 녹음 파일 전사 |
| 16:45 | Build Log 초안 생성 (5절) + 데모 영상 녹화 |
| 17:30 | 제출 마감 |

## 8. 주의

### 무음 구간에서 없는 말을 지어낸다 (2026-08-16 실측)

아무도 말하지 않는 15초 청크에서 이런 게 나왔다:

```
**[10:24]** 많이 딜레이 됐어요. 10분의 시작이라든가. recording stopped.
**[10:24]** 아, 볼, 봐. 볼, 보세요. 블럭이에요.
```

문법이 멀쩡해서 **진짜 발화와 구분이 안 된다.** Whisper의 알려진 특성이고
`_is_hallucination()` 필터가 다 잡지는 못한다. 해커톤장은 여러 팀이 동시에
떠드는 공간이라 옆 테이블 대화까지 섞인다.

**대응 — 소스를 용도별로 나눈다:**

| 소스 | 용도 | 지어낸 문장 위험 |
|---|---|---|
| `meeting.md` (stream) | **CC에게 맥락 주는 용도만** | 있음. 감수한다 |
| 폰 녹음 → 파일 모드 전사 | **제출물 인용문은 여기서만** | 화자 분리로 검증됨 |

Build Log에 넣을 인용은 **반드시 폰 녹음 전사에서** 가져온다. `meeting.md`에서
바로 인용하면 없던 말이 심사 서류에 들어간다.

논의가 없는 시간대에는 stream을 꺼두면 잡음 자체가 줄어든다.

### 그 외

- **자원 경합** — mlx-whisper는 Apple Silicon GPU를 쓴다. `npm run dev`/빌드와
  같은 머신에서 상시 돌면 느려진다. 회의 시간대에만 켠다.
- **원본은 커밋하지 않는다** — `meeting.md`엔 잡담·개인정보가 섞인다.
  `.gitignore`에 넣고 **발췌한 인용만** 제출물에 올린다.

### 사전 점검 완료 (2026-08-16 10:24)

맥 마이크 녹음 · 마이크 권한 · 모델 캐시 · 한국어 전사 · 시각 기록 전부 확인됨.
당일 아침에 권한 팝업이나 모델 다운로드로 지체될 일은 없다.
