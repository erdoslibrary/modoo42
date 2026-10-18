---
description: "디자인 원본의 호버·누름 상태 값과 Phase 3 CSS 구현 지침"
---

# 호버·누름 상태 (Hover / Active)

디자인 원본 HTML은 dc 런타임 전용 속성 `style-hover` / `style-active`로 상태 변화를 기술했다. 이 속성은 표준 CSS가 아니므로 정적 렌더 과정에서 제거됐다. **이 문서가 그 값의 보관소다.** Phase 3에서 표준 CSS로 옮길 때 여기 값을 쓴다.

출처는 dc 템플릿 6개 파일이다. 서로 다른 값은 11종, 사용처는 총 35곳이다.

---

## 1. 누름 (`:active`) — 5종 / 18곳

버튼이 그림자 자리로 들어가면서 그림자가 사라진다. 종이 버튼이 눌려 바닥에 닿는 느낌을 만드는 장치다. 이동 거리는 평소 `box-shadow`의 offset과 **항상 같다.**

| 원본 값 | 사용처 | 평소 `box-shadow` |
| :--- | ---: | :--- |
| `transform:translate(2px,2px);box-shadow:none` | 9곳 | `2px 2px 0 #18181b` |
| `transform:translate(2px,2px);box-shadow:none;color:#fff` | 1곳 | 같음 |
| `transform:translate(3px,3px);box-shadow:none;color:#18181b` | 1곳 | `3px 3px 0 #18181b` |
| `transform:translate(4px,4px);box-shadow:none` | 4곳 | `4px 4px 0 #18181b` |
| `transform:translate(4px,4px);box-shadow:none;color:#18181b` | 3곳 | 같음 |

`color`를 다시 지정한 항목이 있는 이유는 dc 런타임이 호버 스타일과 누름 스타일을 합쳐 적용하기 때문이다. 호버에서 바뀐 글자색이 누름 상태에 남지 않도록 되돌린 값이다. **표준 CSS에서는 `:active`가 `:hover`보다 뒤에 선언되면 자동으로 이긴다. 따라서 이 `color` 재지정은 옮기지 않는다.**

## 2. 호버 (`:hover`) — 6종 / 17곳

| 원본 값 | 사용처 | 대상 |
| :--- | ---: | :--- |
| `background:#6cc546;color:#18181b` | 4곳 | 액센트 버튼 (`[+ 스터디 개설하기]`, `[참여하기 ↗]`). 평소 `#5FB63A` |
| `background:rgba(255,255,255,0.08);color:#fff` | 4곳 | 사이드바 메뉴 (비활성 항목) |
| `color:#3c7a1e` | 5곳 | 텍스트 링크 (명예의 전당 항목, `회고 읽기 ↗`) |
| `background:#E4F1D4` | 2곳 | 점선 테두리 개설 카드 |
| `background:#16a34a;color:#fff` | 1곳 | LIVE 핑 `[+ 핑 보내기]` |
| `color:#fff` | 1곳 | 푸터 복사 아이콘 |

---

## 3. Phase 3 구현 지침

### 3.1 깊이는 CSS 변수로 한 번만 정의한다

이동 거리가 2px / 3px / 4px 세 종류뿐이고 항상 `box-shadow` offset과 같다. 요소마다 `translate`를 적지 않고 변수 하나로 묶는다. `src/app/globals.css`에 넣는다.

```css
@layer components {
  /* 네오브루탈리즘 하드 섀도우 + 눌림. --nb-depth로 깊이만 바꿔 쓴다. */
  .nb {
    --nb-depth: 3px;
    border: 2.5px solid #18181b;
    box-shadow: var(--nb-depth) var(--nb-depth) 0 #18181b;
    transition: background-color 120ms, color 120ms;
  }
  .nb:active {
    transform: translate(var(--nb-depth), var(--nb-depth));
    box-shadow: none;
  }
}
```

사용처에서는 깊이만 덮어쓴다. Tailwind arbitrary property를 쓴다.

```tsx
<button className="nb [--nb-depth:4px] bg-[#5FB63A] hover:bg-[#6cc546]">+ 스터디 개설하기</button>
```

`transition`은 `background-color`와 `color`에만 걸고 120ms로 둔다. `transform`에는 걸지 않는다 — 누름 반응이 즉각적이어야 하고, `.claude/rules/anti-ai-slop.md`가 `transition`을 기능적 상태에만 150ms 이하로 제한한다.

### 3.2 호버는 Tailwind `hover:` 변종으로 충분하다

호버 6종은 전부 `background-color`와 `color` 한두 개만 바꾼다. 별도 클래스를 만들 필요가 없다.

| 대상 | Tailwind |
| :--- | :--- |
| 액센트 버튼 | `bg-[#5FB63A] hover:bg-[#6cc546]` |
| 사이드바 메뉴 | `hover:bg-white/[0.08] hover:text-white` |
| 텍스트 링크 | `hover:text-[#3c7a1e]` |
| 점선 개설 카드 | `hover:bg-[#E4F1D4]` |
| LIVE 버튼 | `bg-[#16a34a] hover:bg-[#16a34a] hover:text-white` |

### 3.3 하지 말 것

- 요소마다 `style-hover` 값을 인라인 `style`로 옮기지 않는다. 인라인 스타일로는 `:hover`를 표현할 수 없다.
- `:active`에 `transition`을 걸지 않는다.
- 이동 거리와 `box-shadow` offset을 다르게 두지 않는다. 어긋나면 버튼이 바닥에 닿지 않고 떠 보인다.

---

## 4. 규칙과의 관계

`.claude/rules/anti-ai-slop.md`는 "hover 시 `transform`"을 금지한다. 위 구현은 **`:active`에만** `transform`을 쓰므로 그 금지에 해당하지 않는다. `:active` 변화는 "클릭이 먹었다"는 피드백을 전달하는 기능적 상태다. `CLAUDE.md` §10 "규칙 해석"에 예외로 등재돼 있다.

`:hover`에 `transform`을 쓰는 것은 여전히 금지다.
