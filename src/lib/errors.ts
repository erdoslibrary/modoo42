// AppError 및 HTTP 매핑 (CLAUDE.md §8). 모든 Route Handler는 AppError를 던지고
// 공통 핸들러가 HTTP로 매핑한다.

export type AppErrorCode =
  | 'BAD_REQUEST' // 400: Zod 검증 실패, 상태 머신 위반, LIVE 1일 1회 초과
  | 'CLOSED' // 400: 모집이 마감된 글에 참여 시도
  | 'FULL' // 400: 정원 초과
  | 'FORBIDDEN' // 403: 리더/작성자 본인이 아닌 유저의 수정·취소·판정 시도
  | 'NOT_FOUND' // 404: 게시글 없음
  | 'RATE_LIMITED'; // 429: Rate Limit 초과

const STATUS_MAP: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  CLOSED: 400,
  FULL: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_MAP[code];
  }
}

/** AppError를 HTTP 상태와 바디로 매핑한다. 알 수 없는 오류는 500으로 떨어진다. */
export function toErrorResponse(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof AppError) {
    return { status: err.status, body: { error: err.code } };
  }
  return { status: 500, body: { error: 'INTERNAL' } };
}
