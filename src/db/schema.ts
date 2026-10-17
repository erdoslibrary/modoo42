// src/db/schema.ts — 정의 원본은 docs/trd.md §3.2. 변경 시 같은 PR에서 함께 수정한다.
import { pgTable, uuid, text, timestamp, integer, pgEnum, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const campusEnum = pgEnum('campus_type', ['GS', 'SEOUL']);
export const postTypeEnum = pgEnum('post_type', ['STUDY', 'PARTY', 'LIVE']);
export const postStatusEnum = pgEnum('post_status', ['RECRUITING', 'CLOSED', 'COMPLETED', 'CANCELLED']);
export const locationTypeEnum = pgEnum('location_type', ['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID']);
// LEFT / REMOVED는 스키마에만 남은 미사용 값이다 (CLAUDE.md §6.2). 로직으로 쓰지 않는다.
export const participantStatusEnum = pgEnum('participant_status', ['JOINED', 'LEFT', 'REMOVED', 'COMPLETED', 'INCOMPLETE']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  intraId: text('intra_id').unique().notNull(),
  campus: campusEnum('campus').notNull(),
  completedCount: integer('completed_count').default(0).notNull(),
  leaderCount: integer('leader_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  leaderId: uuid('leader_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  type: postTypeEnum('type').notNull(),

  // [책장/플러그인 아키텍처] 템플릿 식별자 (예: 'cote', 'commit', 'reading', 'duolingo', 'music', 'custom')
  templateId: text('template_id'),

  // [책장/플러그인 아키텍처] 템플릿 전용 특화 데이터 (JSONB, Phase 2 고도화)
  // - 새로운 스터디 유형 추가 시 DB 스키마 수정 없이 TypeScript 정의 PR만으로 확장
  templateData: jsonb('template_data').$type<Record<string, unknown>>(),

  title: text('title').notNull(),
  tags: text('tags').array().notNull(),
  locationType: locationTypeEnum('location_type').notNull(),
  place: text('place'), // 온/오프라인 상세 장소 또는 클러스터 좌석
  maxMembers: integer('max_members'), // 스터디/파티: 2~10명(Zod 검증), LIVE 핑: 미사용(null)
  currentMembers: integer('current_members').default(1).notNull(), // 리더 포함 1명 시작
  cycle: text('cycle'),
  endDate: timestamp('end_date', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // LIVE 핑 만료 시각
  chatUrl: text('chat_url'), // 스터디/파티: 화이트리스트 URL 필수(Zod 검증), LIVE 핑: 미사용(null)
  referenceUrl: text('reference_url'), // 참고 링크 (GitHub/Notion 등)
  description: text('description'),
  status: postStatusEnum('status').default('RECRUITING').notNull(),
  proofType: text('proof_type'),
  proofUrl: text('proof_url'), // 선택 입력 (없어도 완주 가능)
  postmortemText: text('postmortem_text'), // 실패 회고
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('posts_feed_idx').on(table.type, table.status, table.createdAt),
  index('posts_live_ping_idx').on(table.type, table.status, table.expiresAt),
]);

export const participants = pgTable('participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: participantStatusEnum('status').default('JOINED').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('participants_post_user_idx').on(table.postId, table.userId),
  index('participants_user_id_idx').on(table.userId),
]);

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
