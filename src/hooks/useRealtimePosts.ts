'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { FeedPost, PostStatus } from '@/lib/view-types';

// 실시간 동기화 (req FR-014, NFR-004, contracts/realtime-posts.md).
// 채널은 posts-channel 1개만 열고, 서버가 내려준 목록을 기준으로 변경분을 덧입힌다.
// 구독 스키마는 서버가 정한다 — 콘솔 세션이면 dev_sandbox다 (FR-028, research.md R11).
// 채널 이름에 스키마를 붙여 스키마가 바뀌면 이전 채널이 정리되게 한다. 동시 채널은 1개다.
// 구독이 끊기거나 실패해도 서버 렌더 결과를 그대로 유지한다 (spec FR-035) —
// 화면을 비우지 않고, 새로고침으로 최신 상태를 얻을 수 있다.

/** WAL 이벤트에서 받아 쓰는 값만 담는다. 제목·태그 등은 서버 데이터를 유지한다. */
type Patch = {
  currentMembers: number;
  status: PostStatus;
  expiresAt: Date | null;
};

export type FeedLists = {
  pings: FeedPost[];
  parties: FeedPost[];
  studies: FeedPost[];
};

/** 서버 데이터가 갱신됐는지 보는 지문. 바뀌면 쌓아 둔 변경분을 버리고 서버 값으로 되돌린다. */
function signatureOf(lists: FeedLists): string {
  return [...lists.pings, ...lists.parties, ...lists.studies]
    .map((p) => `${p.id}:${p.currentMembers}:${p.status}`)
    .join('|');
}

function patchOf(row: Record<string, unknown>): Patch {
  return {
    currentMembers: Number(row.current_members ?? 0),
    status: String(row.status) as PostStatus,
    expiresAt: row.expires_at ? new Date(String(row.expires_at)) : null,
  };
}

/** 리스트 응답(JSON)의 날짜 문자열을 Date로 되돌린다. */
function reviveFeedPost(raw: Record<string, unknown>): FeedPost {
  return {
    ...(raw as unknown as FeedPost),
    endDate: raw.endDate ? new Date(String(raw.endDate)) : null,
    expiresAt: raw.expiresAt ? new Date(String(raw.expiresAt)) : null,
  };
}

function applyPatches(list: FeedPost[], patches: Record<string, Patch>): FeedPost[] {
  // 같은 이벤트가 두 번 와도 결과가 같다 — 변경분을 덮어쓰기만 한다(멱등).
  return list.map((post) => (patches[post.id] ? { ...post, ...patches[post.id] } : post));
}

export function useRealtimePosts(initial: FeedLists, schema: string): FeedLists {
  const [patches, setPatches] = useState<Record<string, Patch>>({});
  // LIVE 핑 INSERT는 payload에 제목이 없어 그릴 수 없다 → 목록을 다시 받아 교체한다.
  const [refetchedPings, setRefetchedPings] = useState<FeedPost[] | null>(null);

  const signature = signatureOf(initial);

  useEffect(() => {
    // 서버가 새 데이터를 내려줬다(router.refresh·재방문). 변경분을 버리고 서버 값을 기준으로 삼는다.
    setPatches({});
    setRefetchedPings(null);
  }, [signature]);

  useEffect(() => {
    // 환경변수가 없는 환경(로컬 설정 누락)에서는 실시간 없이 서버 렌더 결과만 쓴다.
    const client = (() => {
      try {
        return getSupabaseBrowserClient();
      } catch {
        return null;
      }
    })();
    if (!client) return;

    let refetching = false;
    const channel = client
      .channel(`posts-channel:${schema}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema, table: 'posts' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, unknown>;
          const id = row?.id;
          if (typeof id !== 'string') return;
          setPatches((prev) => ({ ...prev, [id]: patchOf(row) }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema, table: 'posts' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, unknown>;
          // 전광판만 즉시 반영한다. STUDY·PARTY 신규 글은 새로고침·이동 시 보인다.
          if (row?.type !== 'LIVE') return;
          if (refetching) return; // 이벤트 1건당 보강 조회 1회 이하
          refetching = true;
          void fetch('/api/posts?type=LIVE')
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => {
              if (!body?.posts) return; // 실패 시 목록을 바꾸지 않는다(제목 없는 핑을 그리지 않는다)
              setRefetchedPings((body.posts as Record<string, unknown>[]).map(reviveFeedPost));
            })
            .catch(() => undefined)
            .finally(() => {
              refetching = false;
            });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [schema]);

  return useMemo(() => {
    const pings = applyPatches(refetchedPings ?? initial.pings, patches)
      // 작성자가 조기 완료한 핑은 CLOSED로 바뀌며 전광판에서 사라진다 (CLAUDE.md §6.4).
      .filter((ping) => ping.status === 'RECRUITING')
      .sort((a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0));

    return {
      pings,
      parties: applyPatches(initial.parties, patches),
      studies: applyPatches(initial.studies, patches),
    };
  }, [initial, patches, refetchedPings]);
}
