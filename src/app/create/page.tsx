// 개설 화면 (spec FR-024~FR-030). RSC 셸이 유형을 가르고 입력은 클라이언트 폼이 받는다.
// 템플릿 목록은 자기 서버에 HTTP를 다시 쏘지 않고 도메인 함수에서 바로 읽는다 (research R1).
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { LoginRequired } from '@/components/layout/LoginRequired';
import { TypeSwitch, type CreateType } from '@/components/create/TypeSwitch';
import { RecruitForm } from '@/components/create/RecruitForm';
import { LivePingForm } from '@/components/create/LivePingForm';
import { getCurrentUser } from '@/lib/auth';
import { serverNow } from '@/lib/clock';
import { computeStudyEndDate, toKstWall } from '@/lib/end-date';
import { listTemplates } from '@/lib/templates';
import { toPublicUser } from '@/lib/public-user';

// 세션에 따라 내용이 갈리고 종료일 안내가 오늘 날짜에 걸려 있어 정적 프리렌더 대상이 아니다.
export const dynamic = 'force-dynamic';

const pad2 = (n: number) => String(n).padStart(2, '0');

export default async function CreatePage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const me = await getCurrentUser();
  if (!me) {
    return (
      <AppShell me={null} active="/create">
        <LoginRequired />
      </AppShell>
    );
  }

  const type: CreateType =
    searchParams.type === 'PARTY' ? 'PARTY' : searchParams.type === 'LIVE' ? 'LIVE' : 'STUDY';

  const now = serverNow();
  // 종료일 안내와 마감일 최솟값은 서버가 계산한다 — 클라이언트 시계·시간대를 믿지 않는다.
  const endWall = toKstWall(computeStudyEndDate(now));
  const endDateNotice = `${endWall.getUTCFullYear()}년 ${endWall.getUTCMonth() + 1}월 ${endWall.getUTCDate()}일`;
  const todayWall = toKstWall(now);
  const minEndDate = `${todayWall.getUTCFullYear()}-${pad2(todayWall.getUTCMonth() + 1)}-${pad2(todayWall.getUTCDate())}`;

  return (
    <AppShell me={toPublicUser(me)} active="/create">
      <div className="mx-auto max-w-[620px]">
        <Link href="/dashboard" className="text-[12px] font-bold hover:text-accent-dark">
          ← 대시보드
        </Link>
        <h1 className="px mt-2 text-[26px]">새 스터디 개설하기</h1>

        <div className="mt-5">
          <TypeSwitch active={type} />
        </div>

        {type === 'LIVE' ? (
          <LivePingForm />
        ) : (
          <RecruitForm
            type={type}
            templates={listTemplates()}
            endDateNotice={endDateNotice}
            minEndDate={minEndDate}
          />
        )}
      </div>
    </AppShell>
  );
}
