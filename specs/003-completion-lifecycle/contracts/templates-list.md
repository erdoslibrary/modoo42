# Contract: GET /api/templates — 템플릿 목록 + 개설 시 템플릿 입력

**인증**: 필요(로그인 유저). **대응**: FR-001~005. trd §3.3, §4.

## GET /api/templates — Response 200

```jsonc
[
  { "id": "coding-test", "title": "코딩테스트", "description": "...", "defaultTags": ["코딩테스트"] },
  { "id": "book", "title": "책 완독", "description": "...", "defaultTags": ["책 완독"] }
  // ... 6종, 등록 순서대로
]
```

`dataSchema`·`CustomFormField`는 직렬화하지 않는다.

## POST /api/posts 확장 (기존 계약 `specs/002-recruit-join-core/contracts/posts-create.md`에 추가)

```jsonc
{
  "type": "STUDY",
  "templateId": "book",                                   // 선택
  "templateData": { "bookTitle": "클린 코드", "totalPages": 584 },  // 선택, templateId 필요
  // ... 기존 필드
}
```

| 조건 | 결과 |
| :-- | :-- |
| `templateId` 없음, `templateData` 없음 | Phase 1과 동일 (`template_*`, `proof_type` = `null`) |
| `templateId` 있음, 데이터 규칙 통과 | `template_id`·`template_data`·`proof_type`(= `defaultProofType`) 저장 |
| `templateData`만 있음 | 400 |
| 미등록 `templateId` | 400 |
| `type='PARTY'`에 `templateId` | 400 |
| `dataSchema` 위반(필수 누락·형식·미정의 항목) | 400 |
| `free`에 비어 있지 않은 `templateData` | 400 |

상세 조회(`GET /api/posts/:id`) 응답에 `templateData` 필드를 추가한다(전체 공개).
