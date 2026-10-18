// 입력 검증 (CLAUDE.md §7, NFR-002). 서버 측 Zod가 최종 방어선이며 프론트 검증은 보조다.
// 도메인 불변식은 새로 만들지 않고 CLAUDE.md §7.1 값을 그대로 쓴다.
import { z } from 'zod';

// chat_url 화이트리스트 정규식 3종 (NFR-002). http:// · 타 도메인은 전부 거부한다.
export const CHAT_URL_PATTERNS: readonly RegExp[] = [
  /^https:\/\/open\.kakao\.com\//,
  /^https:\/\/discord\.gg\//,
  /^https:\/\/discord\.com\/invite\//,
];

export function isAllowedChatUrl(url: string): boolean {
  return CHAT_URL_PATTERNS.some((re) => re.test(url));
}

/** chat_url에서 플랫폼 종류를 유도한다 (전체 공개 메타, chat_url 자체는 참여자 전용). */
export function deriveChatPlatform(url: string): 'kakao' | 'discord' | null {
  if (/^https:\/\/open\.kakao\.com\//.test(url)) return 'kakao';
  if (/^https:\/\/discord\.(gg|com)\//.test(url)) return 'discord';
  return null;
}

// 공용 필드 스키마 (스토리별 입력 스키마가 조합해 쓴다).
export const chatUrlSchema = z
  .string()
  .refine(isAllowedChatUrl, { message: 'chat_url은 허용된 오픈채팅/디스코드 링크만 가능하다.' });

export const referenceUrlSchema = z
  .string()
  .regex(/^https:\/\//, { message: 'reference_url은 https:// 링크만 가능하다.' });

// 개설 입력은 4종만 받는다. DB 열거형의 OFFLINE_ETC는 LIVE 핑 서버 파생 전용이라 제외한다 (FR-016).
const locationTypeSchema = z.enum(['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID']);

// 개설 입력 (FR-001). 도메인 불변식(CLAUDE.md §7.1)을 그대로 고정한다.
export const createPostSchema = z.object({
  type: z.enum(['STUDY', 'PARTY']),
  templateId: z.string().optional(),
  // 형태만 검증한다. 템플릿별 내용 규칙은 src/lib/templates.ts resolveTemplate이 맡는다.
  templateData: z.record(z.string(), z.unknown()).optional(),
  title: z.string().min(1).max(40), // 최대 40자 (필수)
  tags: z.array(z.string().min(1)).min(1).max(3), // 최대 3개 (필수)
  locationType: locationTypeSchema,
  place: z.string().optional(),
  maxMembers: z.number().int().min(2).max(10).default(10), // 2~10, 기본 10
  // 온라인 요소가 있는 모집(ONLINE·HYBRID)만 필수. 오프라인 전용은 선택.
  // 조건부 강제는 아래 createPostRequestSchema의 superRefine이 맡는다 (CLAUDE.md §7.1).
  chatUrl: chatUrlSchema.optional(),
  referenceUrl: referenceUrlSchema.optional(),
  description: z.string().max(300).optional(), // 최대 300자 (선택)
  // PARTY만 사용. STUDY는 보내도 서비스에서 무시하고 자동 산출.
  endDate: z.coerce.date().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// LIVE 핑 개설 입력 (FR-011). text 최대 50자, duration 30분/1시간/2시간/3시간 (CLAUDE.md §7.1).
// max_members·chat_url·tags는 LIVE에 없으므로 strict로 추가 키를 거부한다.
export const createLivePingSchema = z
  .object({
    type: z.literal('LIVE'),
    text: z.string().min(1).max(50),
    place: z.string().min(1), // 찾아가기 용도라 필수
    durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(120), z.literal(180)]),
  })
  .strict();

export type CreateLivePingInput = z.infer<typeof createLivePingSchema>;

// POST /api/posts는 type으로 STUDY/PARTY와 LIVE를 가른다.
// chat_url 조건부 필수는 union 바깥 superRefine에서 건다 — discriminatedUnion 멤버는 ZodObject여야 하므로
// createPostSchema에 직접 .superRefine을 걸면 union 구성이 깨진다.
export const createPostRequestSchema = z
  .discriminatedUnion('type', [createPostSchema, createLivePingSchema])
  .superRefine((val, ctx) => {
    if (val.type === 'LIVE') return;
    const online = val.locationType === 'ONLINE' || val.locationType === 'HYBRID';
    if (online && !val.chatUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['chatUrl'],
        message: '온라인·온/오프라인 병행 모집은 chat_url이 필수다.',
      });
    }
  });

// 수정 입력 (FR-009). title/description/chatUrl/place만, 전부 선택(부분 수정).
export const updatePostSchema = z
  .object({
    title: z.string().min(1).max(40),
    description: z.string().max(300).nullable(),
    chatUrl: chatUrlSchema,
    place: z.string().nullable(),
  })
  .partial()
  .strict(); // 허용 외 필드는 거부

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// 상태 토글 입력 (FR-004).
export const statusToggleSchema = z.object({
  status: z.enum(['RECRUITING', 'CLOSED']),
});

// 취소 입력 (FR-005).
export const cancelSchema = z.object({
  reason: z.string().min(1).max(300),
});

// 완주 벌크 판정 입력 (FR-008). 형태만 검증하고, 실제 참여자 집합과의 일치는 서비스가 잠금 안에서 확인한다.
export const completePostSchema = z.object({
  evaluations: z
    .array(z.object({ userId: z.uuid(), isCompleted: z.boolean() }))
    .min(1),
  proofUrl: referenceUrlSchema.optional(), // 증빙 URL은 선택, 입력 시 https://만
});

// 실패 회고 입력 (FR-009). 앞뒤 공백을 다듬은 뒤 1~1000자.
export const postmortemSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});
