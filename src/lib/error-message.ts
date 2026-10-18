// 서버 에러 코드 → 화면 문장 (spec FR-024, CLAUDE.md §8).
// 응답 바디는 { error: <코드> }뿐이고 서버 메시지는 실리지 않는다(errors.ts).
// 따라서 같은 코드가 여러 상황을 덮을 때는 화면이 이미 가진 글 정보로 문장을 가린다.

const MESSAGES: Record<string, string> = {
  BAD_REQUEST: '입력이 올바르지 않습니다.',
  CLOSED: '모집이 마감되었습니다.',
  FULL: '정원이 찼습니다.',
  FORBIDDEN: '권한이 없습니다. 리더 본인만 할 수 있습니다.',
  NOT_FOUND: '게시글을 찾을 수 없습니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  INTERNAL: '서버에서 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
};

/** 응답 바디에서 코드를 꺼낸다. 형식이 다르면 INTERNAL로 본다. */
export function errorCodeOf(body: unknown): string {
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return 'INTERNAL';
}

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? MESSAGES.INTERNAL;
}

/**
 * 참여 실패 문장. CLOSED는 "수동·정원 마감"과 "단기 파티 마감일 경과"를 함께 덮으므로
 * 화면이 가진 글 정보로 가린다 (contracts/party-expiry.md §3).
 */
export function joinErrorMessage(
  code: string,
  post: { type: string; endDate: Date | string | null },
  now: Date = new Date(),
): string {
  if (code === 'CLOSED' && post.type === 'PARTY' && post.endDate) {
    const end = post.endDate instanceof Date ? post.endDate : new Date(post.endDate);
    if (end.getTime() <= now.getTime()) return '마감일이 지난 파티입니다.';
  }
  return errorMessage(code);
}

/**
 * LIVE 핑 등록 실패 문장. 프론트 검증이 길이·유효시간을 먼저 걸러내므로,
 * 폼이 유효한 상태에서 돌아온 BAD_REQUEST는 하루 1회 제한이다 (req FR-011).
 */
export function livePingErrorMessage(code: string): string {
  if (code === 'BAD_REQUEST') {
    return 'LIVE 핑은 하루에 한 번만 보낼 수 있습니다. 내일 00시(KST)에 다시 열립니다.';
  }
  return errorMessage(code);
}
