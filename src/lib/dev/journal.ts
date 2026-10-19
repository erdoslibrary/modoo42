// 저장소의 마지막 마이그레이션 태그 (FR-028, contracts/sandbox-isolation.md S2).
//
// 콘솔 진입이 이 값을 dev_sandbox.sandbox_meta.journal_tag와 대조한다. 다르면 진입을
// 실패시키고 pnpm sandbox:sync를 안내한다 — 조용히 낡은 스키마로 동작하지 않는다.
//
// 런타임 파일 읽기 대신 JSON을 import한다. 번들에 값이 박히므로 drizzle/이 배포 산출물에
// 들어가지 않는 환경에서도 같은 판정이 된다.
import journal from '../../../drizzle/meta/_journal.json';

export function repoJournalTag(): string {
  const entries = journal.entries;
  if (!entries || entries.length === 0) {
    throw new Error('drizzle/meta/_journal.json에 엔트리가 없다.');
  }
  return entries[entries.length - 1].tag;
}
