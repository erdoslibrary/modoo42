# [TRD] 모두의 42 (Modu-42) — 기술 요구사항 명세서

* **문서 버전:** v2.0 (Production-Ready)
* **대상:** 프로덕션 서비스 운영 수준 아키텍처 및 구현 명세
* **연관 문서:** [plan.md](./plan.md) (기획), [prd.md](./prd.md) (기능 명세), [requirement.md](./requirement.md) (요구사항 정의서)

---

## 1. 기술 스택 (Tech Stack)

| 영역 | 선택 기술 | 선정 이유 및 역할 |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router) + TypeScript + Tailwind CSS | React Server Components(RSC)를 통한 초기 렌더링 최적화 및 SEO |
| **Backend** | Next.js Route Handlers (`app/api/**`) | Vercel Serverless Function 기반 경량 API 레이어 |
| **ORM** | **Drizzle ORM** + `drizzle-kit` | 제로 런타임 오버헤드, 완벽한 TypeScript 타입 추론, 원자적 트랜잭션(`db.transaction`) |
| **Database** | **Supabase (PostgreSQL)** | 안정적인 관계형 DB, Connection Pooling, 강력한 RLS |
| **Realtime** | **Supabase Realtime Engine** | PostgreSQL WAL(Write-Ahead Log) 기반 실시간 이벤트 브로드캐스트 (LIVE 핑, 참여자 수) |
| **Authentication** | 42 Intra OAuth 2.0 PKCE + Supabase Auth | 신뢰할 수 있는 42 카뎃 인증, HttpOnly 쿠키 세션 관리 |
| **Testing** | **Vitest** | 초고속 단위/통합 테스트, Drizzle 인메모리/컨테이너 모킹 지원 |
| **CI/CD & Deploy** | GitHub Actions + Vercel | PR 자동 테스트/린트 검증, Vercel 자동 프리뷰/프로덕션 배포 |

---

## 2. 인증 및 인가 플로우 (Auth Flow)

1. **로그인 시작:** 유저 `[42로 로그인]` 클릭 → 42 Intra OAuth 인가 엔드포인트로 리다이렉트 (PKCE + `state` 파라미터 검증).
2. **토큰 교환:** 콜백(`/api/auth/callback`)에서 `code` 수신 → 42 API로 `access_token` 교환.
3. **유저 식별 및 캠퍼스 파싱:** 
   - 42 `/v2/me` 호출하여 `login`(`intra_id`), `campus_users` 조회.
   - 캠퍼스를 `GS`(경산) 또는 `SEOUL`(서울)로 매핑.
   - *(외부 프로필 이미지는 수집하지 않으며, 프론트엔드에서 intraId 앞 2자리 영문 대문자 이니셜 뱃지로 렌더링)*
4. **계정 동기화:** 
   - Supabase Auth 유저 생성/조회 후 Drizzle ORM으로 `users` 테이블에 Upsert.
5. **세션 발급:** Supabase 세션 토큰을 `Max-Age=30일`, `HttpOnly`, `Secure`, `SameSite=Lax` 지속성 쿠키로 저장.
6. **권한 인가 및 라우팅 (Next.js middleware.ts):**
   - **미인증 유저:** 대시보드(`/dashboard`) 접근 시 소개 랜딩 페이지(`/login`)로 307 리다이렉트.
   - **인증 유저:** 루트(`/`) 또는 로그인 페이지(`/login`) 접근 시 대시보드(`/dashboard`)로 0초 만에 자동 직행 (Zero-Click).
   - **DB 보안:** Supabase RLS로 direct DB 쿼리 권한 격리.

---

## 3. 데이터베이스 스키마 명세 (Drizzle ORM)

```typescript
// src/db/schema.ts
import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const campusEnum = pgEnum('campus_type', ['GS', 'SEOUL']);
export const postTypeEnum = pgEnum('post_type', ['STUDY', 'PARTY', 'LIVE']);
export const postStatusEnum = pgEnum('post_status', ['RECRUITING', 'CLOSED', 'COMPLETED', 'CANCELLED']);
export const locationTypeEnum = pgEnum('location_type', ['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID']);
export const participantStatusEnum = pgEnum('participant_status', ['JOINED', 'LEFT', 'REMOVED', 'COMPLETED', 'INCOMPLETE']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // Supabase auth.users.id와 1:1 매핑
  intraId: text('intra_id').unique().notNull(),
  campus: campusEnum('campus').notNull(),
  completedCount: integer('completed_count').default(0).notNull(),
  leaderCount: integer('leader_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  leaderId: uuid('leader_id').references(() => users.id).notNull(),
  type: postTypeEnum('type').notNull(),
  
  // [책장/플러그인 아키텍처] 템플릿 식별자 (예: 'cote', 'commit', 'reading', 'duolingo', 'music', 'custom')
  templateId: text('template_id'),
  
  // [책장/플러그인 아키텍처] 템플릿 전용 특화 데이터 (JSONB)
  // - DB 컬럼 추가 없이 신규 스터디 템플릿을 PR로 자유롭게 확장 가능
  // - 예 (코딩테스트): { platform: "baekjoon", tier: "gold", repoUrl: "https://..." }
  // - 예 (모각코): { commitStreakDays: 7, targetRepo: "..." }
  // - 예 (음악감상): { playlistUrl: "https://..." }
  templateData: jsonb('template_data').$type<Record<string, unknown>>(),

  title: text('title').notNull(),
  tags: text('tags').array().notNull(),
  locationType: locationTypeEnum('location_type').notNull(),
  maxMembers: integer('max_members').notNull(),
  currentMembers: integer('current_members').default(0).notNull(),
  cycle: text('cycle'),
  endDate: timestamp('end_date', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // LIVE 핑 만료 시각
  chatUrl: text('chat_url').notNull(),
  description: text('description'),
  status: postStatusEnum('status').default('RECRUITING').notNull(),
  proofType: text('proof_type'),
  proofUrl: text('proof_url'),
  postmortemText: text('postmortem_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const participants = pgTable('participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: participantStatusEnum('status').default('JOINED').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  participations: many(participants),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  leader: one(users, { fields: [posts.leaderId], references: [users.id] }),
  participants: many(participants),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  post: one(posts, { fields: [participants.postId], references: [posts.id] }),
  user: one(users, { fields: [participants.userId], references: [users.id] }),
}));
```

### 3.1 모듈형 템플릿 레지스트리 아키텍처 (Bookcase / Plugin Pattern)

* **배경 & 철학:** 플랫폼은 스터디 '책장(수명주기, 모집, 참여, 완주)'만 제공하고, 다양한 스터디 주제는 '책(템플릿)' 형태로 꽂는 플러그인 구조를 취합니다.
* **오픈소스 기여 구조:** 새로운 스터디 유형(예: LeetCode 스터디, 외국어 회화 스터디)을 추가할 때 기존 DB 스키마 수정 없이, TypeScript 정의 파일 1개만 PR로 제출하면 UI 폼과 검증 로직이 자동 확장됩니다.

```typescript
// src/templates/types.ts
import { z } from 'zod';

export interface StudyTemplate<TData = Record<string, unknown>> {
  id: string;                     // 템플릿 고유 ID (예: 'cote', 'music')
  title: string;                  // 템플릿 이름 (예: '코딩테스트')
  description: string;            // 기본 설명
  defaultTags: string[];          // 자동 완성 태그 (예: ['#알고리즘', '#백준'])
  defaultProofType: string;       // 권장 증빙 방식 (예: 'GitHub 레포')
  
  // 템플릿별 특화 데이터 검증용 Zod 스키마
  dataSchema?: z.ZodType<TData>;
  
  // 개설 폼에서 렌더링할 전용 추가 입력 필드 컴포넌트
  CustomFormField?: React.ComponentType<{
    value: TData;
    onChange: (val: TData) => void;
  }>;
}

// src/templates/registry.ts (템플릿 등록소)
export const templateRegistry: Record<string, StudyTemplate> = {
  cote: {
    id: 'cote',
    title: '코딩테스트',
    description: '매주 n문제 알고리즘 문제 풀이 및 깃허브 코드 리뷰',
    defaultTags: ['#알고리즘', '#코테'],
    defaultProofType: 'GitHub 레포',
    dataSchema: z.object({
      targetPlatform: z.enum(['baekjoon', 'programmers', 'leetcode']).default('baekjoon'),
      weeklyProblemCount: z.number().min(1).max(20).default(3),
    }),
  },
  commit: {
    id: 'commit',
    title: '모각코',
    description: '모여서 각자 코딩 및 1일 1커밋 달성',
    defaultTags: ['#모각코', '#잔디심기'],
    defaultProofType: 'GitHub 레포',
  },
  // 추후 오픈소스 PR을 통해 추가될 템플릿들 (독서, 듀오링고, 음악 감상 등)
};
```

---

## 4. 핵심 트랜잭션 및 API 명세

| Method | Endpoint | 설명 | 인증 |
| :--- | :--- | :--- | :--- |
| GET | `/api/posts` | 대시보드 리스트 조회 (필터: `type`, `status`, `sort`) | 필요 |
| GET | `/api/posts/:id` | 게시글 상세 조회 (참여자 목록 포함) | 필요 |
| POST | `/api/posts` | 신규 스터디/파티/LIVE 핑 생성 (LIVE 핑은 유저당 1일 1회 생성 제한 검증) | 필요 |
| PUT | `/api/posts/:id` | 리더의 게시글 수정 (제목, 설명, 오픈채팅 링크, 장소) | 필요 (리더 본인) |
| POST | `/api/posts/:id/complete-ping` | 작성자의 LIVE 핑 조기 완료(전광판 소멸) | 필요 (작성자 본인) |
| POST | `/api/posts/:id/join` | 원클릭 참여 (Drizzle 트랜잭션) | 필요 |
| POST | `/api/posts/:id/leave` | *(제외)* 자진 참여 취소 (확정 참여 원칙에 따라 제외) | 불필요 |
| DELETE | `/api/posts/:id/participants/:userId` | *(제외)* 리더의 허수 참여자 강퇴 (해커톤 스코프 아웃) | 불필요 |
| POST | `/api/posts/:id/cancel` | 리더의 스터디 중도 취소 | 필요 (리더 본인) |
| POST | `/api/posts/:id/complete` | 완주 벌크 판정 (팀원 판정 필수, 증빙 URL 선택, 완료 시 리더 leader_count+1 & 완주자 completed_count+1 가산, 정규 스터디는 매월 15~30일 기간 검증) | 필요 (리더 본인) |
| POST | `/api/posts/:id/postmortem` | 실패 회고 작성 (익월 10일 도과 미판정 스터디도 자동 대상 포함) | 필요 (리더 본인) |
| GET | `/api/list` | 터미널 CLI 조회용 엔드포인트 | 불필요 |
| GET | `/api/leaderboard` | 성실 멤버 상위 랭킹 조회 | 필요 |

### 4.1 원자적 참여 트랜잭션 로직 (`POST /api/posts/:id/join`)

```typescript
export async function joinStudy(postId: string, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. 게시글 행 잠금 (Row Lock)
    const [post] = await tx
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .for('update');

    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    if (post.status !== 'RECRUITING') throw new AppError('CLOSED', '모집이 마감된 스터디입니다.');

    // 2. 기존 참여 여부 확인
    const [existing] = await tx
      .select()
      .from(participants)
      .where(and(eq(participants.postId, postId), eq(participants.userId, userId)));

    if (existing && existing.status === 'JOINED') {
      return { chatUrl: post.chatUrl, reJoined: true };
    }

    // 3. 정원 초과 검증
    if (post.currentMembers >= post.maxMembers) {
      throw new AppError('FULL', '정원이 초과되었습니다.');
    }

    // 4. 참여 기록 추가 또는 재참여 상태 복구
    if (existing) {
      await tx
        .update(participants)
        .set({ status: 'JOINED', joinedAt: new Date() })
        .where(eq(participants.id, existing.id));
    } else {
      await tx.insert(participants).values({ postId, userId, status: 'JOINED' });
    }

    // 5. 정원 카운트 증가 및 마감 자동 전이
    const nextCount = post.currentMembers + 1;
    const isClosed = nextCount >= post.maxMembers;

    await tx
      .update(posts)
      .set({
        currentMembers: nextCount,
        status: isClosed ? 'CLOSED' : 'RECRUITING',
      })
      .where(eq(posts.id, postId));

    return { chatUrl: post.chatUrl, reJoined: false };
  });
}
```

---

## 5. 실시간 동기화 (Supabase Realtime)

1. **테이블 복제 설정 (WAL):**
   - `posts` 및 `participants` 테이블을 Supabase `supabase_realtime` publication에 등록.
2. **클라이언트 이벤트 구독:**
   - 대시보드 컴포넌트 마운트 시 `posts`의 `current_members`, `status` 변경 이벤트 구독.
   - LIVE 핑 신규 Insert 이벤트 감지 시 상단 핑 목록 즉각 prepend.
   - 참여자가 참여/탈퇴 시 별도 폴링 없이 모든 클라이언트 화면에 실시간 숫자 갱신.

---

## 6. 테스트 및 CI/CD 전략

### 6.1 테스트 파이프라인 (Vitest)
- **Unit / Domain Tests:** Drizzle 트랜잭션 모킹 또는 로컬 PostgreSQL 연동을 통한 비즈니스 로직(TC-POST, TC-JOIN, TC-LEAVE, TC-RACE, TC-LEADER, TC-COMPLETE) 자동화 검증.
- **Rule Verification:** 상태 머신 역전 방어 및 동시성 락 동작 검증.

### 6.2 GitHub Actions CI/CD 워크플로우
- **PR 트리거:**
  1. `pnpm lint`
  2. `pnpm typecheck`
  3. `pnpm test` (Vitest)
  4. `drizzle-kit check` (스키마 충돌 및 변경 검증)
- **Main 브랜치 Push:**
  1. Drizzle 마이그레이션 적용 (`drizzle-kit migrate`)
  2. Vercel 자동 프로덕션 배포
