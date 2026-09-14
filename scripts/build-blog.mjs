// Notion DB -> 정적 블로그 페이지 생성 스크립트
//
// 환경변수:
//   NOTION_TOKEN         - Notion internal integration 토큰 (필수)
//   NOTION_DATABASE_ID   - 블로그 데이터베이스 ID (필수)
//
// 실행: node scripts/build-blog.mjs

import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { marked } from "marked";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderLayout, escapeHtml } from "./template.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "blog");
const ASSETS_DIR = path.join(ROOT, "assets", "blog");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error(
    "NOTION_TOKEN, NOTION_DATABASE_ID 환경변수가 필요합니다."
  );
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

// 이미지 블록 커스텀 처리: Notion 내부 업로드 이미지 URL은 시간이 지나면 만료되므로
// 빌드 시점에 다운로드해서 리포지토리 안 /assets/blog/<slug>/ 에 영구 저장한다.
let currentSlug = null;
let imageCounter = 0;

n2m.setCustomTransformer("image", async (block) => {
  const image = block.image;
  const url = image.type === "external" ? image.external.url : image.file.url;
  const caption = (image.caption || []).map((c) => c.plain_text).join("") || "";

  try {
    const localPath = await downloadImage(url, currentSlug);
    return `![${caption.replace(/[[\]]/g, "")}](${localPath})`;
  } catch (err) {
    console.warn(`  이미지 다운로드 실패 (${url}): ${err.message}`);
    return false; // 기본 렌더러(원본 URL)로 폴백
  }
});

async function downloadImage(url, slug) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = guessExtension(url, res.headers.get("content-type"));
  imageCounter += 1;
  const fileName = `img-${imageCounter}${ext}`;

  const dir = path.join(ASSETS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), buffer);

  return `/assets/blog/${slug}/${fileName}`;
}

function guessExtension(url, contentType) {
  const fromUrl = path.extname(new URL(url).pathname);
  if (fromUrl && fromUrl.length <= 5) return fromUrl;
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  return map[contentType] || ".png";
}

function slugify(title) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-") // 문자/숫자 외에는 하이픈으로 (한글 포함)
    .replace(/^-+|-+$/g, "");
  return slug || "post";
}

function findPropertyByType(properties, type, nameHint) {
  const entries = Object.entries(properties);
  if (nameHint) {
    const byName = entries.find(
      ([name, prop]) => prop.type === type && name.toLowerCase().includes(nameHint)
    );
    if (byName) return byName[1];
  }
  const byType = entries.find(([, prop]) => prop.type === type);
  return byType ? byType[1] : null;
}

function getTitle(properties) {
  const prop = findPropertyByType(properties, "title");
  if (!prop) return "제목 없음";
  return prop.title.map((t) => t.plain_text).join("") || "제목 없음";
}

function getDate(properties, fallback) {
  const prop = findPropertyByType(properties, "date", "일");
  const value = prop?.date?.start;
  return value ? value.slice(0, 10) : fallback.slice(0, 10);
}

function getTags(properties) {
  const prop = findPropertyByType(properties, "multi_select");
  return prop ? prop.multi_select.map((t) => t.name) : [];
}

// "상태" 속성이 있으면 발행(Published/발행) 상태인 글만 필터링.
// 속성 자체가 없으면 전부 발행 대상으로 간주한다.
function isPublished(properties) {
  const entries = Object.entries(properties);
  const statusProp = entries.find(
    ([name, prop]) =>
      prop.type === "select" && /상태|status/i.test(name)
  );
  if (!statusProp) return true;
  const value = statusProp[1].select?.name || "";
  return /발행|publish/i.test(value);
}

async function queryAllPages() {
  const pages = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function main() {
  console.log("Notion 데이터베이스 조회 중...");
  const rawPages = await queryAllPages();

  const posts = rawPages
    .filter((p) => !p.archived && !p.in_trash && isPublished(p.properties))
    .map((p) => ({
      id: p.id,
      title: getTitle(p.properties),
      date: getDate(p.properties, p.created_time),
      tags: getTags(p.properties),
    }));

  posts.sort((a, b) => (a.date < b.date ? 1 : -1));

  // slug 중복 방지
  const usedSlugs = new Set();
  for (const post of posts) {
    let slug = slugify(post.title);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${post.id.slice(0, 8)}`;
    }
    usedSlugs.add(slug);
    post.slug = slug;
  }

  console.log(`발행 대상 ${posts.length}개 글 변환 시작`);

  for (const post of posts) {
    console.log(`  - ${post.title} (${post.slug})`);
    currentSlug = post.slug;
    imageCounter = 0;

    const mdBlocks = await n2m.pageToMarkdown(post.id);
    const { parent: markdown } = n2m.toMarkdownString(mdBlocks);
    const contentHtml = marked.parse(markdown || "");

    const tagsHtml = post.tags
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    const bodyHtml = `
      <article class="content">
        <h1>${escapeHtml(post.title)}</h1>
        <div class="post-meta">${post.date}${tagsHtml ? " · " + tagsHtml : ""}</div>
        ${contentHtml}
      </article>
    `;

    const html = renderLayout({
      title: `${post.title} - Numberer Blog`,
      description: post.title,
      bodyHtml,
      rootPath: "../..",
    });

    const postDir = path.join(BLOG_DIR, post.slug);
    fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(path.join(postDir, "index.html"), html);
  }

  // 목록 페이지
  const listItemsHtml = posts.length
    ? posts
        .map(
          (post) => `
      <li>
        <a href="./${post.slug}/index.html">${escapeHtml(post.title)}</a>
        <div class="post-date">${post.date}</div>
      </li>`
        )
        .join("")
    : `<li class="empty">아직 작성된 글이 없습니다.</li>`;

  const indexBody = `
    <h1>Blog</h1>
    <ul class="post-list">${listItemsHtml}</ul>
  `;

  const indexHtml = renderLayout({
    title: "Blog - Numberer",
    description: "Numberer의 블로그",
    bodyHtml: indexBody,
    rootPath: "..",
  });

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.writeFileSync(path.join(BLOG_DIR, "index.html"), indexHtml);

  // 더 이상 존재하지 않는(삭제/비공개 처리된) 글 디렉터리 정리
  cleanupStaleDirs(BLOG_DIR, usedSlugs, ["index.html"]);
  cleanupStaleDirs(ASSETS_DIR, usedSlugs, []);

  console.log("빌드 완료.");
}

function cleanupStaleDirs(baseDir, keepSlugs, keepFiles) {
  if (!fs.existsSync(baseDir)) return;
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !keepSlugs.has(entry.name)) {
      fs.rmSync(path.join(baseDir, entry.name), { recursive: true, force: true });
      console.log(`  정리됨: ${path.relative(ROOT, path.join(baseDir, entry.name))}`);
    } else if (entry.isFile() && !keepFiles.includes(entry.name)) {
      // 목록/에셋 디렉터리에 남아있는 예상 밖 파일은 건드리지 않는다.
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
