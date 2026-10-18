// 개설 카드(점선)의 16×16 도트 개구리. 도트 좌표·색은 docs/designs/Dashboard.html의
// 개설 카드 인라인 SVG에서 그대로 옮겼다 (FR-019).
// 개구리 도감(requirement.md §1.3 보류)과 무관하고 이 한 자리에만 쓴다 —
// 색 변형 prop을 받지 않는다 (contracts/design-tokens.md C4).
const INK = '#18181b';
const EYE = '#ffffff';
const BODY = '#3C8FE8';

const PALETTE: Record<string, string> = { k: INK, w: EYE, b: BODY };

// 행 하나가 y 좌표, 글자 하나가 x 좌표다. `.`은 빈 칸이다.
const ROWS = [
  '................',
  '...kk......kk...',
  '..kwwk....kwwk..',
  '..kwkk....kwkk..',
  '.kkbbkkkkkkbbkk.',
  '.kbbbbbbbbbbbbk.',
  'kkbbbbbbbbbbbbkk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  '.kbbbbbbbbbbbbk.',
  '.kbbbbbbbbbbbbk.',
  '..kbbbbbbbbbbk..',
  '...kkbb..bbkk...',
  '.....kk..kk.....',
  '................',
] as const;

export function PixelFrog({ size = 42 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' }}
      aria-hidden="true"
    >
      {ROWS.flatMap((row, y) =>
        row.split('').map((cell, x) =>
          cell === '.' ? null : (
            // 1.02는 원본 값이다 — 인접 도트 사이에 머리카락 틈이 보이지 않게 겹친다.
            <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={PALETTE[cell]} />
          ),
        ),
      )}
    </svg>
  );
}
