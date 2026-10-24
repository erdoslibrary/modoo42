# modoo42 ![Status](https://img.shields.io/badge/status-WIP-orange)
> 경계를 넘어 함께 성장하는 목적 중심 스터디 & 네트워킹 매칭 플랫폼
> 
> 🌐 **라이브 서비스**: [https://modoo42.vercel.app](https://modoo42.vercel.app/)

### 누구에게 필요할까?

- **취준생**: 기약 없는 취준 기간, 피드백 없는 코드와 계속되는 거절 속에서 고립감을 느낄 때
- **주니어/실무자**: 사수나 팀 내 논의할 동료 없이 혼자 기술적 벽에 부딪힐 때의 외로움
- **느슨한 연대와 일상의 몰입을 원하는 사람**: 딱딱한 스터디뿐 아니라 모각코, 커피챗, 음악 감상 등 온·오프라인에서 부담 없이 함께할 동료가 필요할 때


### 해결 방식 및 철학
불필요한 친목과 잡담, 복잡한 절차를 걷어내고 **'목표를 함께 달성할 동료 매칭'** 에 집중합니다.  
자체 채팅 대신 리더가 설정한 외부 채널(카카오 오픈채팅, 디스코드 등)로 즉시 연결해 소통 피로도를 줄이고 실행력을 높입니다.

| 목표 구현 (Demo) | 정규 스터디 (Demo) |
| :---: | :---: |
| <img src="docs/목표%20구현.gif" alt="목표 구현 데모" width="100%"> | <img src="docs/정규%20스터디.gif" alt="정규 스터디 데모" width="100%"> |

---

## 빠른 시작 (로컬 개발 환경)

### 1단계: 환경 구축 (Node.js 20+ 필수, pnpm 권장)

> [!IMPORTANT]
> **Node.js 버전 요구사항**: 반드시 **Node.js 20 이상**(`node -v`)을 사용해야 합니다. Node.js 18 이하 버전에서는 `drizzle-kit`(마이그레이션 및 스키마 검증) 실행 시 모듈 호환성 오류가 발생합니다.

저장소를 클론하고 의존성 패키지를 설치합니다:

```bash
# 저장소 클론 및 디렉토리 진입
git clone https://github.com/erdoslibrary/modoo42.git
cd modoo42

# 패키지 매니저(pnpm)를 통한 의존성 설치
pnpm install
```

### 2단계: 환경 변수 설정

`.env.example`을 복사하여 `.env.local` 파일을 생성하고 필수 값을 설정합니다:

```bash
cp .env.example .env.local
```

주요 설정 항목:

```ini
# Supabase PostgreSQL 접속 문자열 (Transaction Pooler 또는 Direct)
DATABASE_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"

# Supabase 공개 URL 및 anon 키 (Realtime 구독용)
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 앱 베이스 URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# GitHub OAuth App 자격증명 (프로덕션 환경 필수)
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"

# 개발자 콘솔 게이트 (로컬 테스트 및 샌드박스 격리용 비밀번호)
DEV_CONSOLE_PASSWORD="your_dev_console_password"
```

### 3단계: 데이터베이스 마이그레이션

Drizzle ORM을 통해 Supabase PostgreSQL 인스턴스에 최신 스키마를 적용합니다:

```bash
# 스키마 정합성 검증
pnpm drizzle-kit check

# 마이그레이션 적용
pnpm drizzle-kit migrate

# 개발자 콘솔 샌드박스 동기화 (최초 1회)
pnpm sandbox:sync
```

### 4단계: 개발 서버 실행 및 로컬 테스트

```bash
pnpm dev
```

1. **접속**: [http://localhost:3000](http://localhost:3000) (미인증 시 `/login`으로 자동 리다이렉트)
2. **개발자 콘솔 로그인 (로컬 테스트)**:
   * `/login` 화면 하단의 `[개발자 콘솔로 진입]` 버튼을 누르고 `.env.local`에 설정한 `DEV_CONSOLE_PASSWORD`를 입력합니다.
   * 콘솔 세션 진입 시 `dev_sandbox` 스키마가 격리 활성화되며, 화면 우측 하단에 `[🛠 DEV]` 플로팅 패널이 노출됩니다.
   * `[🛠 DEV]` 패널의 **인증** 탭에서 테스트 페르소나(`gs_leader`, `gs_member`, `seoul_member`, `github_only`)로 즉시 전환할 수 있습니다.
   * (선택) GitHub OAuth App 키가 등록된 환경에서는 실제 `[GitHub 계정으로 로그인]`도 지원합니다.
3. **스터디 생성 및 참여 테스트**:
   * 대시보드에서 '새 스터디 개설' 또는 '단기 파티', 'LIVE 핑'을 등록하고 원클릭 참여 플로우를 검증합니다.

---

## 핵심 기능

* **3단계 목적별 모집 라이프사이클**:
  * **정규 스터디**: 1~3개월 단위 월별 사이클 고정 운영 (월 중순 모집, 월초 시작).
  * **단기 파티**: 컨퍼런스 동행, 해커톤 팀 빌딩 등을 위한 D-Day 타이머 기반 빠른 모집.
  * **LIVE 핑**: 클러스터 즉시 모각코 및 식사/번개 모임을 위한 24시간 TTL 자동 만료 핑.
* **소셜 배제 및 원클릭 즉시 연결**:
  * 웹 내 자체 채팅 기능을 배제하여 개발 복잡도를 낮추고 목적 달성에 집중.
  * 참여 확정 시 리더의 외부 소통 수단(카카오 오픈채팅, 디스코드)으로 즉시 라우팅.
  * 참여 링크(`chat_url`)는 참여자에게만 안전하게 마스킹 해제.
* **비관적 락 기반 동시성 제어**:
  * PostgreSQL 트랜잭션 내 `SELECT ... FOR UPDATE` 락 적용.
  * 동시 다발적 참여 요청 시 정원 초과(Race Condition) 방지 및 원자적 정원 갱신.
* **유연한 완주 판정 및 아카이빙**:
  * 종료일 도래 시 스터디 리더의 원클릭 완주/미완주 체크.
  * 노션 회고록, 깃허브 저장소, 구글 드라이브 등 스터디 성격에 맞춘 자유로운 증빙 URL 등록.
  * 완주 스터디는 '명예의 전당'에, 목표 미달성 스터디는 'Post-mortem(회고록)' 탭에 영구 기록.
* **모듈형 플러그인 템플릿 아키텍처**:
  * 플랫폼은 스터디 기본 라이프사이클을 담는 '책장' 역할 수행.
  * 코딩테스트, 모각코, 책 완독, 듀오링고, 음악 감상 등 세부 스터디 유형을 TypeScript 정의 파일 1개로 DB 마이그레이션 없이 확장.
* **보안 및 GitHub OAuth 2.0**:
  * GitHub 계정 기반 단일 로그인 및 30일 HMAC-SHA256 서명 세션 쿠키 발급.
  * timingSafeEqual 기반 CSRF 방어.
  * 개발자 콘솔 및 샌드박스(`dev_sandbox`) 격리를 통한 안전한 로컬 테스트 환경 지원.

---

## 시스템 아키텍처

Next.js 14 App Router 기반 풀스택 구조로, 프레젠테이션 계층, 비즈니스 로직 및 API 계층, Supabase PostgreSQL 데이터 계층이 유기적으로 연동됩니다.

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}}}%%
flowchart TD
    subgraph Clients ["프레젠테이션 계층 (Presentation)"]
        Web["웹 대시보드 (Next.js 14)<br/>반응형 대시보드 · 스터디 개설 · 완주 판정"]
        CLI["CLI 조회 도구 (curl / HTTP API)<br/>LIVE 핑 및 활성 모집 조회"]
    end

    subgraph App_Server ["애플리케이션 계층 (Next.js App Router)"]
        Auth["인증 & 세션 관리<br/>GitHub OAuth 2.0 · 30일 HMAC 세션 쿠키"]
        RouteHandlers["API Route Handlers<br/>(/api/posts, /api/auth, /api/cli)"]
        Templates["플러그인 템플릿 레지스트리<br/>(코딩테스트, 모각코, 책 완독 등)"]
        Auth --> RouteHandlers
        Templates --> RouteHandlers
    end

    subgraph Data_Layer ["데이터 & 인프라 계층 (Supabase & PostgreSQL)"]
        PostgreSQL["Supabase PostgreSQL<br/>(Drizzle ORM · 비관적 락 SELECT FOR UPDATE)"]
        Realtime["Supabase Realtime<br/>(WebSocket 상태 변경 브로드캐스트)"]
        RouteHandlers --> PostgreSQL
        PostgreSQL -.-> Realtime
    end

    Web <--> RouteHandlers
    Web <--> Realtime
    CLI <--> RouteHandlers
```

---

## 배포 및 CI 파이프라인

* **Frontend & Serverless**: [Vercel](https://modoo42.vercel.app/) 플랫폼에 배포되어 운영 중이며 ([modoo42.vercel.app](https://modoo42.vercel.app/)), `main` 브랜치 푸시 시 자동 배포가 트리거됩니다.
* **Database & BaaS**: Supabase PostgreSQL 및 Supabase Realtime 엔진을 활용합니다.
* **GitHub Actions CI (`.github/workflows/ci.yml`)**:
  * 풀 리퀘스트 생성 시 정적 분석(`pnpm lint`), 타입 검사(`pnpm typecheck`), 프로덕션 빌드 검증(`pnpm build`), DB 스키마 정합성(`pnpm drizzle-kit check`)을 자동 검증합니다.

---

## 테스트 실행

```bash
# 전체 테스트 스위트 실행 (총 305개 테스트, 32개 파일)
pnpm test

# 정적 코드 분석
pnpm lint

# TypeScript 타입 검사
pnpm typecheck
```

---

## 프로젝트 구조

```
modoo42/
├── docs/                 # 기술 설계서(trd.md), 요구사항(requirement.md), 기획서(plan.md)
│   └── designs/          # UI/UX 원형 디자인 명세 및 상호작용 가이드
├── drizzle/              # Drizzle ORM 자동 생성 SQL 마이그레이션 파일
├── specs/                # Spec-Driven Development (speckit) 단계별 아티팩트
├── src/                  # 애플리케이션 소스 코드
│   ├── app/              # Next.js 14 App Router 페이지 및 API Route Handlers
│   │   ├── api/          # REST API 엔드포인트 (/posts, /auth, /cli 등)
│   │   └── ...           # 프론트엔드 라우트
│   ├── components/       # 재사용 React UI 컴포넌트
│   ├── db/               # PostgreSQL 클라이언트 및 Drizzle 스키마 정의 (schema.ts)
│   ├── hooks/            # 클라이언트 커스텀 훅 (Realtime 구독 훅 등)
│   ├── lib/              # 공통 유틸리티 (인증 세션, Supabase 클라이언트, 에러 핸들러)
│   └── templates/        # 모듈형 스터디 템플릿 등록부 (registry.ts)
└── tests/                # 단위 및 통합 테스트 스위트 (Vitest)
```

---

## Team & Roles

* **서비스명**: modoo42 (변경 예정)
* **개발 기간**:
  * **해커톤 MVP**: 2026.10.16 ~ 2026.10.18 (프로토타입 수립)
  * **기능 고도화**: 2026.10.19 ~

| 팀원 | 역할 및 담당 영역 |
| :--- | :--- |
| [@erdoslibrary](https://github.com/erdoslibrary) | Full-stack Architecture, Backend & Database, Frontend Integration |

---

## Acknowledgments

본 프로젝트는 아래의 오픈소스 기술 및 라이브러리를 기반으로 개발되었습니다:

* [Next.js](https://nextjs.org/) - React 기반 풀스택 웹 프레임워크
* [Supabase](https://supabase.com/) - 오픈소스 기반 PostgreSQL 데이터베이스 및 Realtime 엔진
* [Drizzle ORM](https://orm.drizzle.team/) - TypeScript-first 객체 관계 매핑 라이브러리
* [Tailwind CSS](https://tailwindcss.com/) - 유틸리티 우선 CSS 프레임워크
* [Vitest](https://vitest.dev/) - 고성능 단위 및 통합 테스트 프레임워크
* [Zod](https://zod.dev/) - TypeScript 우선 스키마 선언 및 데이터 검증 라이브러리

---

## License

본 프로젝트는 [Apache License 2.0](LICENSE)을 따릅니다.

---

<div align="center">


> **"내가 보고 싶었던 장면이, 누군가 정말 필요로 했던 경험이 될 때까지"**

— [Tae hyeon Kim](https://www.linkedin.com/pulse/google-deepmind-%ED%95%B4%EC%BB%A4%ED%86%A4-%EC%9A%B0%EC%8A%B9-%EC%83%9D%EA%B0%81%ED%8E%B8-ai-%EC%8B%9C%EB%8C%80%EC%97%90-%EB%82%B4-%EC%83%9D%EA%B0%81%EC%9D%84-%EA%B5%AC%EC%B2%B4%ED%99%94%ED%95%9C%EB%8B%A4%EB%8A%94-%EA%B2%83-tae-hyeon-kim-ddo7c/)

</div>


