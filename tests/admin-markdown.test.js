import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMarkdownPost } from '../admin-markdown.js'

test('imports a plain Markdown document using its first heading as the title', () => {
  const markdown = '# QXY Web：Cloudflare Pages + GitHub OAuth 安全发布配置手册\n\n文档说明。\n\n## 0. 最终效果\n\n发布流程。'
  const post = parseMarkdownPost(markdown, '2026-10-18')
  assert.equal(post.title, 'QXY Web：Cloudflare Pages + GitHub OAuth 安全发布配置手册')
  assert.equal(post.date, '2026-10-18')
  assert.equal(post.content, '文档说明。\n\n## 0. 最终效果\n\n发布流程。')
})

test('imports UTF-8 BOM and CRLF frontmatter without losing metadata', () => {
  const markdown = '\uFEFF---\r\ntitle: Existing article\r\ndate: 2026-10-17\r\ntags: [A, B]\r\n---\r\n\r\nBody text'
  const post = parseMarkdownPost(markdown, '2026-10-18')
  assert.equal(post.title, 'Existing article')
  assert.equal(post.date, '2026-10-17')
  assert.deepEqual(post.tags, ['A', 'B'])
  assert.equal(post.content, 'Body text')
})
