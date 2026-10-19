// 서비스 소개 랜딩 (FR-015). 인증 유저는 0초 만에 /dashboard로 직행한다 (Zero-Click).
import { redirect } from 'next/navigation';
import { ConsoleEntry } from '@/components/dev/ConsoleEntry';
import { getCurrentUser } from '@/lib/auth';
import { isDevConsoleEnabled } from '@/lib/dev/console-session';

export const dynamic = 'force-dynamic';

// 콜백이 ?error=로 돌려보내는 실패 사유. 사용자가 다음에 뭘 해야 하는지까지 적는다.
const ERROR_MESSAGE: Record<string, string> = {
  state: '로그인 요청이 만료되었거나 위조되었습니다. 다시 시도해 주세요.',
  denied: 'GitHub에서 권한 요청을 취소했습니다.',
  token: 'GitHub 토큰 교환에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  profile: 'GitHub 프로필을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.',
  exchange: '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  config: '서버에 GitHub OAuth 설정이 없습니다. 관리자에게 알려 주세요.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const me = await getCurrentUser();
  if (me) redirect('/dashboard');

  const error = searchParams.error ? ERROR_MESSAGE[searchParams.error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="nb w-full max-w-[460px] rounded-[12px] bg-card p-8 [--nb-depth:4px]">
        <span className="px grid h-[46px] w-[46px] place-items-center rounded-[8px] border-[2.5px] border-ink bg-accent text-[17px] text-ink shadow-[3px_3px_0_#18181b]">
          42
        </span>

        <h1 className="px mt-5 text-[24px] leading-snug">모두의 42</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          42 멤버의 스터디 · 단기 파티 · LIVE 핑을 한곳에서 모집하고, 완주 기록으로 남깁니다.
        </p>

        <ul className="mt-5 space-y-2 text-[14px] leading-relaxed text-[#4b5040]">
          <li>정규 스터디와 단기 파티를 한 번의 클릭으로 참여합니다.</li>
          <li>지금 클러스터에서 필요한 도움을 LIVE 핑으로 띄웁니다.</li>
          <li>완주 기록은 명예의 전당과 성실 멤버 랭킹에 남습니다.</li>
        </ul>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-[8px] border-[2.5px] border-ink bg-white px-4 py-3 text-[14px] leading-relaxed text-ink"
          >
            {error}
          </p>
        )}

        <a
          href="/api/auth/github"
          className="nb px mt-7 block rounded-[10px] bg-accent px-5 pb-[14px] pt-4 text-center text-[16px] text-ink [--nb-depth:4px]"
        >
          GitHub 계정으로 로그인
        </a>

        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          GitHub 공개 프로필의 계정 식별자와 핸들만 읽습니다. 프로필 이미지는 저장하지 않습니다.
        </p>

        {/* 개발 전용 입구. DEV_CONSOLE_PASSWORD가 없는 환경에서는 아예 렌더하지 않는다 (FR-027). */}
        {isDevConsoleEnabled() && <ConsoleEntry />}
      </section>
    </main>
  );
}
