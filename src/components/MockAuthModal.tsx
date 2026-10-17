'use client';

// 개발 환경 전용 플로팅 Mock 인증 모달 (FR-002). 상용 빌드에서는 렌더하지 않는다.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PERSONA_BUTTONS: { key: string; label: string }[] = [
  { key: 'gs_leader', label: 'GS 리더' },
  { key: 'gs_member', label: 'GS 멤버' },
  { key: 'seoul_cadet', label: 'SEOUL 카뎃' },
  { key: 'guest', label: '로그아웃' },
];

export function MockAuthModal() {
  // 상용에서는 UI 자체를 노출하지 않는다 (CLAUDE.md §6.1, 서버·클라이언트 이중 차단).
  if (process.env.NODE_ENV !== 'development') return null;

  return <MockAuthModalInner />;
}

function MockAuthModalInner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  async function selectPersona(persona: string) {
    setPending(persona);
    try {
      await fetch('/api/mock-auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      router.refresh(); // 세션 교체 즉시 반영.
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999 }}>
      {open && (
        <div
          style={{
            marginBottom: 8,
            padding: 12,
            background: '#EDEFE0',
            border: '2.5px solid #18181b',
            boxShadow: '4px 4px 0 #18181b',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minWidth: 160,
          }}
        >
          {PERSONA_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => selectPersona(key)}
              disabled={pending !== null}
              style={{
                padding: '6px 10px',
                background: key === 'guest' ? '#EDEFE0' : '#5FB63A',
                color: '#18181b',
                border: '2.5px solid #18181b',
                cursor: pending ? 'wait' : 'pointer',
                textAlign: 'left',
                fontWeight: 600,
              }}
            >
              {pending === key ? '전환 중…' : label}
            </button>
          ))}
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
        🛠 Mock Auth
      </button>
    </div>
  );
}
