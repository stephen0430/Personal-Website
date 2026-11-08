import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFrontmatterValue } from '../lib/frontmatter.js'

test('splits legacy unquoted frontmatter tags into separate values', () => {
  assert.deepEqual(parseFrontmatterValue('[U-Net, 深度学习, 图像分割]'), ['U-Net', '深度学习', '图像分割'])
})

test('preserves commas inside quoted YAML list items', () => {
  assert.deepEqual(parseFrontmatterValue('["AI, ML", Python, \'author\'\'s note\']'), ['AI, ML', 'Python', "author's note"])
})

test('parses JSON arrays and quoted scalar metadata', () => {
  assert.deepEqual(parseFrontmatterValue('["U-Net", "Deep Learning"]'), ['U-Net', 'Deep Learning'])
  assert.equal(parseFrontmatterValue('"Title: with, punctuation"'), 'Title: with, punctuation')
})
