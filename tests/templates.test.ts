import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, getPostDetail } from '@/lib/posts';
import { resolveTemplate, listTemplates } from '@/lib/templates';
import { templateRegistry } from '@/templates/registry';
import { posts } from '@/db/schema';

const base = {
  type: 'STUDY' as const,
  title: '템플릿 테스트',
  tags: ['책 완독'],
  locationType: 'ONLINE' as const,
  maxMembers: 5,
  chatUrl: 'https://open.kakao.com/o/template',
};

const badRequest = { code: 'BAD_REQUEST' };

describe('템플릿 등록부 (FR-007)', () => {
  it('6종 프리셋이 등록 순서대로 존재한다', () => {
    expect(Object.keys(templateRegistry)).toEqual([
      'coding-test',
      'mogakco',
      'book',
      'duolingo',
      'music',
      'free',
    ]);
  });

  it('listTemplates는 공개 필드만 반환한다 (dataSchema 미노출)', () => {
    const list = listTemplates();
    expect(list).toHaveLength(6);
    for (const t of list) {
      expect(Object.keys(t).sort()).toEqual(['defaultTags', 'description', 'id', 'title']);
    }
  });
});

describe('resolveTemplate — 템플릿 특화 데이터 검증 (research R6)', () => {
  it('템플릿·데이터 모두 없으면 null 3종', () => {
    expect(resolveTemplate('STUDY', undefined, undefined)).toEqual({
      templateId: null,
      templateData: null,
      proofType: null,
    });
  });

  it('데이터만 있음 / PARTY에 템플릿 / 미등록 ID → BAD_REQUEST', () => {
    expect(() => resolveTemplate('STUDY', undefined, { bookTitle: 'x' })).toThrow(
      expect.objectContaining(badRequest),
    );
    expect(() => resolveTemplate('PARTY', 'book', { bookTitle: 'x' })).toThrow(
      expect.objectContaining(badRequest),
    );
    expect(() => resolveTemplate('STUDY', 'nope', undefined)).toThrow(expect.objectContaining(badRequest));
  });

  it('free: 데이터 없으면 통과(proofType link), 데이터 있으면 BAD_REQUEST', () => {
    expect(resolveTemplate('STUDY', 'free', undefined)).toEqual({
      templateId: 'free',
      templateData: null,
      proofType: 'link',
    });
    expect(() => resolveTemplate('STUDY', 'free', { a: 1 })).toThrow(expect.objectContaining(badRequest));
  });

  it('book: bookTitle 필수·60자 제한, 통과 시 proofType notion', () => {
    expect(() => resolveTemplate('STUDY', 'book', {})).toThrow(expect.objectContaining(badRequest));
    expect(() => resolveTemplate('STUDY', 'book', undefined)).toThrow(expect.objectContaining(badRequest));
    expect(() => resolveTemplate('STUDY', 'book', { bookTitle: 'a'.repeat(61) })).toThrow(
      expect.objectContaining(badRequest),
    );
    expect(resolveTemplate('STUDY', 'book', { bookTitle: '클린 코드', totalPages: 584 })).toEqual({
      templateId: 'book',
      templateData: { bookTitle: '클린 코드', totalPages: 584 },
      proofType: 'notion',
    });
  });

  it('미정의 항목은 strict로 거부한다', () => {
    expect(() => resolveTemplate('STUDY', 'book', { bookTitle: 'x', foo: 1 })).toThrow(
      expect.objectContaining(badRequest),
    );
  });

  it.each([
    ['duolingo', {}], // language 필수
    ['coding-test', { platform: 'CODEFORCES' }],
    ['coding-test', { weeklyGoal: 51 }],
    ['mogakco', { weeklySessions: 8 }],
    ['music', { weeklyAlbums: 0 }],
  ])('%s 규칙 위반 %j → BAD_REQUEST', (id, data) => {
    expect(() => resolveTemplate('STUDY', id, data)).toThrow(expect.objectContaining(badRequest));
  });

  it.each([
    ['coding-test', { platform: 'BOJ', weeklyGoal: 10 }, 'github'],
    ['mogakco', { weeklySessions: 3, timeSlot: '평일 저녁' }, 'github'],
    ['duolingo', { language: '프랑스어', dailyXp: 50 }, 'screenshot'],
    ['music', { genre: '재즈', weeklyAlbums: 2 }, 'notion'],
  ])('%s 정상 데이터 통과 (proofType %s)', (id, data, proofType) => {
    expect(resolveTemplate('STUDY', id, data)).toEqual({ templateId: id, templateData: data, proofType });
  });
});

describe('createPost + 템플릿 통합', () => {
  it('book 템플릿 개설 → template_id·template_data·proof_type 저장, 상세에 templateData 노출', async () => {
    await withRollback(async (tx) => {
      const leader = (await resolvePersonaUser('gs_leader', tx))!;
      const data = { bookTitle: '클린 코드', totalPages: 584 };
      const post = await createPost({ ...base, templateId: 'book', templateData: data }, leader.id, tx, new Date());

      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.templateId).toBe('book');
      expect(row.templateData).toEqual(data);
      expect(row.proofType).toBe('notion');

      const detail = await getPostDetail(post.id, leader.id, tx);
      expect(detail.templateData).toEqual(data);
    });
  });

  it('템플릿 없는 개설은 Phase 1과 동일 (template_* · proof_type null)', async () => {
    await withRollback(async (tx) => {
      const leader = (await resolvePersonaUser('gs_leader', tx))!;
      const post = await createPost(base, leader.id, tx, new Date());
      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.templateId).toBeNull();
      expect(row.templateData).toBeNull();
      expect(row.proofType).toBeNull();
    });
  });

  it('템플릿 규칙 위반 개설 → BAD_REQUEST, 글 미생성', async () => {
    await withRollback(async (tx) => {
      const leader = (await resolvePersonaUser('gs_leader', tx))!;
      await expect(createPost({ ...base, templateId: 'book', templateData: {} }, leader.id, tx, new Date())).rejects.toMatchObject(
        badRequest,
      );
    });
  });
});
