// 공개 유저 투영과 캠퍼스 파생 (FR-016). DB를 런타임 import하지 않는다 — 타입만 가져오므로
// 클라이언트 번들과 순수 모듈(cli-format.ts)에서도 안전하다.
import type { users } from '@/db/schema';

export type Campus = (typeof users.$inferSelect)['campus'];

/** 응답에 나가는 유저 정보. avatar_url 미수집, 42 Intra ID는 싣지 않는다 (CLAUDE.md §7.2). */
export type PublicUser = { login: string; campus: Campus };

export function toPublicUser(u: { login: string; campus: Campus }): PublicUser {
  return { login: u.login, campus: u.campus };
}

/**
 * LIVE 핑의 장소 분류를 작성자 캠퍼스에서 파생한다 (FR-006, data-model.md §3).
 * 캠퍼스가 null인 유저(42 추가 인증 미완료)는 OFFLINE_ETC로 기록하며 등록을 차단하지 않는다.
 * 정규 스터디·단기 파티는 유저가 고른 값을 쓰므로 이 함수를 쓰지 않는다.
 */
export function campusToLocationType(campus: Campus): 'OFFLINE_GS' | 'OFFLINE_SEOUL' | 'OFFLINE_ETC' {
  if (campus === 'GS') return 'OFFLINE_GS';
  if (campus === 'SEOUL') return 'OFFLINE_SEOUL';
  return 'OFFLINE_ETC';
}
