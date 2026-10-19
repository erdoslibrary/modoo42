'use client';

// 개발자 콘솔 패널 본체 — 인증 · 시계 · 시나리오 3섹션 (FR-027, prd.md F7).
// 스타일은 삭제된 MockAuthModal의 네오브루탈리즘 패널을 그대로 잇는다. 새 색·모션·글리프를
// 들이지 않는다 (.claude/rules/anti-ai-slop.md, CLAUDE.md §10).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDevClock } from '@/components/dev/ClockProvider';
import { PERSONAS } from '@/lib/personas';
import {
  PRESET_LABELS,
  POST_REQUIRED_PRESETS,
  SCENARIO_PRESETS,
  type ScenarioPreset,
} from '@/lib/dev/presets';
import type { SessionSource } from '@/lib/auth';

const PERSONA_BUTTONS: { key: string; label: string }[] = [
  ...Object.entries(PERSONAS).map(([key, { label }]) => ({ key, label })),
];

const SOURCE_LABEL: Record<SessionSource, string> = {
  session: 'session (GitHub 로그인)',
  persona: 'persona (Mock 페르소나)',
  anonymous: '비로그인',
};

const PANEL: React.CSSProperties = {
  marginBottom: 8,
  padding: 12,
  background: '#EDEFE0',
  border: '2.5px solid #18181b',
  boxShadow: '4px 4px 0 #18181b',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  width: 280,
  maxHeight: '70vh',
  overflowY: 'auto',
};

const BUTTON: React.CSSProperties = {
  padding: '6px 10px',
  background: '#5FB63A',
  color: '#18181b',
  border: '2.5px solid #18181b',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 13,
};

const SUBTLE: React.CSSProperties = { ...BUTTON, background: '#EDEFE0' };
const HEADING: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#6b705c' };

/** 유효 시각을 KST 벽시계 문자열로 (표시 전용). */
function kstLabel(date: Date): string {
  const wall = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${wall.getUTCFullYear()}-${p(wall.getUTCMonth() + 1)}-${p(wall.getUTCDate())} ` +
    `${p(wall.getUTCHours())}:${p(wall.getUTCMinutes())}:${p(wall.getUTCSeconds())} KST`
  );
}

/** datetime-local 입력값(KST 벽시계)을 ISO 8601 +09:00 문자열로. */
function toKstIso(localValue: string): string {
  return `${localValue.length === 16 ? `${localValue}:00` : localValue}+09:00`;
}

export function DevConsolePanel({
  sessionSource,
  sandboxActive,
}: {
  sessionSource: SessionSource;
  /** 현재 요청이 dev_sandbox를 보고 있는지. 패널 하단 안내에 쓴다. */
  sandboxActive: boolean;
}) {
  const router = useRouter();
  const clock = useDevClock();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState('');
  const [password, setPassword] = useState('');
  const [tick, setTick] = useState(() => clock.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(clock.now()), 1000);
    return () => clearInterval(timer);
    // clock 객체는 매 렌더 새로 만들어진다. 실제 의존은 오프셋 값 하나다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.offsetMs]);

  async function send(key: string, url: string, method: 'POST' | 'DELETE', body?: unknown) {
    if (pending) return;
    setPending(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `요청 실패 (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const disabled = pending !== null;

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999 }}>
      {open && (
        <div style={PANEL}>
          {/* ── 진입 ── 콘솔 세션이 없을 때만 보인다. /login은 로그인 유저를 /dashboard로
              돌려보내므로 입구가 거기 하나면 OAuth 로그인 상태에서 진입할 길이 없다. */}
          {!sandboxActive && (
            <>
              <span style={HEADING}>진입</span>
              <span style={{ fontSize: 11, color: '#6b705c', lineHeight: 1.5 }}>
                진입하면 이 세션의 쓰기가 dev_sandbox로 들어가고 다음 진입 시 사라집니다.
                오픈채팅방 링크는 더미입니다.
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="콘솔 비밀번호"
                style={{
                  padding: '5px 8px',
                  border: '2.5px solid #18181b',
                  background: '#fff',
                  fontSize: 12,
                }}
              />
              <button
                style={BUTTON}
                disabled={disabled || password === ''}
                onClick={() => send('console-enter', '/api/dev/console', 'POST', { password })}
              >
                {pending === 'console-enter' ? '진입 중…' : '콘솔 진입'}
              </button>
            </>
          )}

          {/* ── 인증 ── */}
          <span style={HEADING}>인증</span>
          <span style={{ fontSize: 12 }}>해석 소스: {SOURCE_LABEL[sessionSource]}</span>
          {sessionSource === 'session' && (
            <span style={{ fontSize: 11, color: '#6b705c' }}>
              modoo42_session이 우선입니다. 페르소나 버튼은 효과가 없습니다.
            </span>
          )}
          {/* 페르소나 전환은 콘솔 세션에 종속된다 (FR-027). 세션이 없으면 404이므로 숨긴다. */}
          {sandboxActive &&
            PERSONA_BUTTONS.map(({ key, label }) => (
              <button
                key={key}
                style={BUTTON}
                disabled={disabled}
                onClick={() => send(key, '/api/mock-auth', 'POST', { persona: key })}
              >
                {pending === key ? '전환 중…' : label}
              </button>
            ))}
          {sandboxActive && (
            <button
              style={SUBTLE}
              disabled={disabled}
              onClick={() => send('persona-clear', '/api/mock-auth', 'POST', { persona: 'guest' })}
            >
              페르소나 해제
            </button>
          )}
          {/* 로그아웃은 콘솔과 무관한 기존 엔드포인트라 세션 유무와 상관없이 쓸 수 있다. */}
          <button
            style={SUBTLE}
            disabled={disabled}
            onClick={() => send('logout', '/api/auth/logout', 'POST')}
          >
            세션 쿠키 삭제 (로그아웃)
          </button>

          {/* 시계·시나리오는 콘솔 세션이 있어야 반영된다 (FR-009). 없으면 403이므로 숨긴다. */}
          {sandboxActive && (
            <>
              {/* ── 시계 ── */}
              <span style={HEADING}>시계</span>
              <span style={{ fontSize: 12 }}>{kstLabel(tick)}</span>
              <input
                type="datetime-local"
                step={1}
                value={at}
                onChange={(e) => setAt(e.target.value)}
                style={{
                  padding: '5px 8px',
                  border: '2.5px solid #18181b',
                  background: '#fff',
                  fontSize: 12,
                }}
              />
              <button
                style={BUTTON}
                disabled={disabled || at === ''}
                onClick={() => send('clock-at', '/api/dev/clock', 'POST', { at: toKstIso(at) })}
              >
                {pending === 'clock-at' ? '이동 중…' : '이동'}
              </button>
              <button
                style={SUBTLE}
                disabled={disabled}
                onClick={() => send('clock-reset', '/api/dev/clock', 'DELETE')}
              >
                실제 시각으로 복귀
              </button>

              {/* ── 시나리오 ── */}
              <span style={HEADING}>시나리오</span>
              {SCENARIO_PRESETS.map((preset: ScenarioPreset) => {
                const needsPost = POST_REQUIRED_PRESETS.includes(preset);
                return (
                  <button
                    key={preset}
                    style={needsPost ? SUBTLE : BUTTON}
                    // 글이 필요한 3종은 상세 모달의 "이 글 기준으로 이동"에서만 활성된다 (FR-021).
                    disabled={disabled || needsPost}
                    title={needsPost ? '상세 모달의 "이 글 기준으로 이동"에서 사용합니다.' : undefined}
                    onClick={() => send(preset, '/api/dev/clock', 'POST', { preset })}
                  >
                    {pending === preset ? '이동 중…' : PRESET_LABELS[preset]}
                  </button>
                );
              })}
            </>
          )}

          {error && (
            <span role="alert" style={{ fontSize: 11, color: '#18181b' }}>
              {error === 'SANDBOX_STALE'
                ? 'dev_sandbox 스키마가 낡았습니다. pnpm sandbox:sync를 실행하세요.'
                : error === 'UNAUTHORIZED'
                  ? '비밀번호가 올바르지 않습니다.'
                  : error}
            </span>
          )}

          <span style={{ fontSize: 11, color: '#6b705c', lineHeight: 1.5 }}>
            시계는 되돌아가지만 데이터는 되돌아가지 않습니다.
            {sandboxActive
              ? ' 이 세션의 쓰기는 dev_sandbox에만 들어갑니다. 오픈채팅방 링크는 더미입니다.'
              : ' 지금은 운영 데이터를 보고 있습니다.'}
          </span>
          {sandboxActive && (
            <button
              style={SUBTLE}
              disabled={disabled}
              onClick={() => send('console-exit', '/api/dev/console', 'DELETE')}
            >
              콘솔 종료
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '8px 12px',
          background: '#18181b',
          color: '#EDEFE0',
          border: '2.5px solid #18181b',
          boxShadow: '4px 4px 0 #18181b',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        Dev Console
      </button>
    </div>
  );
}
