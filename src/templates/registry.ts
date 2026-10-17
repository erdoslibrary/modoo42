// 템플릿 플러그인 등록부 (책장/플러그인 아키텍처, CLAUDE.md §6.5).
// 신규 템플릿은 여기에 정의 1건을 추가해 DB 마이그레이션 없이 확장한다.
// 기본 프리셋 6종(코딩테스트·모각코·책 완독·듀오링고·음악 감상·자유)은 Phase 2 A에서 등록한다.
// 특화 데이터 규칙은 specs/003-completion-lifecycle/data-model.md "Template" 표가 원본이다.
// dataSchema는 전부 strict — 정의되지 않은 항목은 거부해 template_data JSONB를 깨끗하게 유지한다.
import { z } from 'zod';
import type { StudyTemplate } from './types';

const codingTest: StudyTemplate = {
  id: 'coding-test',
  title: '코딩테스트',
  description: '매주 정한 개수만큼 알고리즘 문제를 풀고 풀이를 공유합니다.',
  defaultTags: ['코딩테스트'],
  defaultProofType: 'github',
  dataSchema: z
    .object({
      platform: z.enum(['BOJ', 'PROGRAMMERS', 'LEETCODE', 'OTHER']).optional(),
      weeklyGoal: z.number().int().min(1).max(50).optional(),
    })
    .strict(),
};

const mogakco: StudyTemplate = {
  id: 'mogakco',
  title: '모각코',
  description: '정해진 시간에 모여 각자 코딩하고 진행 상황을 짧게 나눕니다.',
  defaultTags: ['모각코'],
  defaultProofType: 'github',
  dataSchema: z
    .object({
      weeklySessions: z.number().int().min(1).max(7).optional(),
      timeSlot: z.string().max(20).optional(),
    })
    .strict(),
};

const book: StudyTemplate = {
  id: 'book',
  title: '책 완독',
  description: '한 권을 정해 함께 읽고 사이클 안에 완독합니다.',
  defaultTags: ['책 완독'],
  defaultProofType: 'notion',
  dataSchema: z
    .object({
      bookTitle: z.string().min(1).max(60),
      totalPages: z.number().int().min(1).max(5000).optional(),
    })
    .strict(),
};

const duolingo: StudyTemplate = {
  id: 'duolingo',
  title: '듀오링고',
  description: '매일 듀오링고로 외국어를 학습하고 스트릭을 인증합니다.',
  defaultTags: ['듀오링고'],
  defaultProofType: 'screenshot',
  dataSchema: z
    .object({
      language: z.string().min(1).max(20),
      dailyXp: z.number().int().min(1).max(1000).optional(),
    })
    .strict(),
};

const music: StudyTemplate = {
  id: 'music',
  title: '음악 감상',
  description: '매주 앨범을 골라 듣고 감상을 남깁니다.',
  defaultTags: ['음악 감상'],
  defaultProofType: 'notion',
  dataSchema: z
    .object({
      genre: z.string().max(20).optional(),
      weeklyAlbums: z.number().int().min(1).max(20).optional(),
    })
    .strict(),
};

// 자유 주제는 특화 데이터가 없다 (데이터를 보내면 400).
const free: StudyTemplate = {
  id: 'free',
  title: '자유',
  description: '주제와 방식을 자유롭게 정하는 스터디입니다.',
  defaultTags: [],
  defaultProofType: 'link',
};

// 등록 순서 = 템플릿 목록 노출 순서.
export const templateRegistry: Record<string, StudyTemplate> = Object.fromEntries(
  [codingTest, mogakco, book, duolingo, music, free].map((t) => [t.id, t]),
);

export function getTemplate(id: string): StudyTemplate | undefined {
  return templateRegistry[id];
}
