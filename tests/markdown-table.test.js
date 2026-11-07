import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdownTable } from '../lib/markdown-table.js'

const inline = value => value

test('renders image-only Markdown tables as a gallery and keeps every image', () => {
  const lines = [
    '| ![one](/one.png) | ![two](/two.png) |',
    '| --- | --- |',
    '| ![three](/three.png) | ![four](/four.png) |'
  ]
  const result = renderMarkdownTable(lines, 0, inline)
  assert.equal(result.end, 2)
  assert.equal((result.html.match(/<div>!\[/g) || []).length, 4)
  assert.match(result.html, /article-image-grid/)
})

test('renders ordinary Markdown tables with semantic headers and rows', () => {
  const lines = ['| Name | Score |', '| --- | --- |', '| Ada | 95 |']
  const result = renderMarkdownTable(lines, 0, inline)
  assert.match(result.html, /<th scope="col">Name<\/th>/)
  assert.match(result.html, /<td>Ada<\/td><td>95<\/td>/)
  assert.doesNotMatch(result.html, /article-image-grid/)
})

test('does not consume non-table content', () => {
  assert.equal(renderMarkdownTable(['A paragraph', 'next'], 0, inline), null)
})
