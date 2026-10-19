// 개발 환경 Mock 페르소나 정의 (FR-000, FR-016). 정의 원본은 trd.md §2.1.
// 세션 해석(auth.ts)과 선택 UI(components/dev/DevConsolePanel.tsx)가 이 한 곳을 읽는다.
// @/db를 런타임 import하지 않는다 — 클라이언트 컴포넌트가 읽기 때문이다.
import type { Campus } from '@/lib/public-user';

export type Persona = {
  /** 모달 버튼에 쓰는 화면 라벨. */
  label: string;
  /** 불변 매칭 키. Upsert 충돌 기준이며 실제 GitHub 숫자 식별자와 형태가 겹치지 않는다. */
  githubId: string;
  /** 표시용 핸들. */
  login: string;
  /** 42 추가 인증을 모사하지 않는 페르소나는 null이다. intra_id·intra_verified_at은 채우지 않는다. */
  campus: Campus;
};

export const PERSONAS: Record<string, Persona> = {
  gs_leader: { label: 'GS 리더', githubId: 'mock:gs_leader', login: 'gs_leader', campus: 'GS' },
  gs_member: { label: 'GS 멤버', githubId: 'mock:gs_member', login: 'gs_member', campus: 'GS' },
  seoul_member: { label: 'SEOUL 멤버', githubId: 'mock:seoul_member', login: 'seoul_member', campus: 'SEOUL' },
  // 캠퍼스 뱃지 미렌더와 LIVE 핑 OFFLINE_ETC 파생을 눌러보기 위한 페르소나 (FR-016).
  github_only: { label: 'GitHub 전용', githubId: 'mock:github_only', login: 'github_only', campus: null },
};
