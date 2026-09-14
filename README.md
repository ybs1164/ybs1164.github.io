# ybs1164.github.io

my portfolio site

## 블로그 (Notion 연동)

노션 데이터베이스에 글을 쓰면 GitHub Actions가 10분마다 확인해서 `/blog`를 자동으로 생성/갱신합니다.

- 빌드 스크립트: [scripts/build-blog.mjs](scripts/build-blog.mjs)
- 워크플로우: [.github/workflows/sync-notion-blog.yml](.github/workflows/sync-notion-blog.yml)

### 최초 설정 (한 번만)

1. Notion DB를 integration과 연결 (`···` 메뉴 또는 [my-integrations](https://www.notion.so/my-integrations)의 Access 탭에서 페이지 추가)
2. 이 저장소 **Settings → Secrets and variables → Actions**에 아래 두 개 등록
   - `NOTION_TOKEN`: integration 토큰
   - `NOTION_DATABASE_ID`: 블로그 데이터베이스 ID

### DB 속성

- **제목** (title) — 필수
- **작성일** (date) — 없으면 글 생성일로 대체
- **태그** (multi_select) — 선택
- **상태** (select) — 선택. 없으면 모든 글을 발행 상태로 간주. 추가하면 값이 "발행"/"Published"인 글만 노출됩니다.

### 로컬에서 직접 빌드

```bash
NOTION_TOKEN=xxx NOTION_DATABASE_ID=xxx npm run build:blog
```
