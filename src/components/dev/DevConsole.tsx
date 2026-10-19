// 개발자 콘솔 마운트 지점 (FR-027). 게이트 판정은 **서버에서** 한다 —
// 게이트가 닫히면 null을 반환하고 쿠키도 읽지 않는다 (contracts/dev-console-api.md C1).
//
// 비밀번호·오프셋 판정 로직은 이 파일과 dev/console-session.ts에 머물고 클라이언트
// 번들로 넘어가지 않는다. 패널은 표시에 필요한 값만 prop으로 받는다.
import { cookies } from 'next/headers';
import { DevConsolePanel } from '@/components/dev/DevConsolePanel';
import { MOCK_COOKIE_NAME, sessionSourceOf } from '@/lib/auth';
import { hasValidConsoleSession, isDevConsoleEnabled } from '@/lib/dev/console-session';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export function DevConsole() {
  if (!isDevConsoleEnabled()) return null;

  const jar = cookies();
  const sessionSource = sessionSourceOf({
    session: jar.get(SESSION_COOKIE_NAME)?.value,
    persona: jar.get(MOCK_COOKIE_NAME)?.value,
  });

  return (
    <DevConsolePanel sessionSource={sessionSource} sandboxActive={hasValidConsoleSession()} />
  );
}
