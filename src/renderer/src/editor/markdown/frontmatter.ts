/**
 * Front matter detection and reassembly for Marki documents.
 * Owns split/join of YAML (---), TOML (+++), and JSON ({…}) blocks at offset 0.
 * Invalid YAML is still preserved as front matter; js-yaml validation is best-effort only.
 */

// js-yaml's ESM build exposes named exports only; a default import breaks the
// production bundle even though it resolves in dev.
import { load as loadYaml } from 'js-yaml'
import type { FrontMatter, FrontMatterFormat } from '@shared/types'

const YAML_FENCE = /^---\r?\n/
const YAML_END = /\r?\n(---|\.\.\.)\s*(?:\r?\n|$)/
const TOML_FENCE = /^\+\+\+\r?\n/
const TOML_END = /\r?\n\+\+\+\s*(?:\r?\n|$)/

function stripLeadingBlankLine(body: string): string {
  if (body.startsWith('\r\n')) return body.slice(2)
  if (body.startsWith('\n')) return body.slice(1)
  return body
}

function parseJsonFrontMatter(text: string): { raw: string; body: string } | null {
  if (!text.startsWith('{')) return null
  let depth = 0
  let inString = false
  let escape = false
  let end = -1

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }

  if (end < 0) return null

  const after = text.slice(end + 1)
  const lineBreak = after.match(/^(\r?\n)/)
  if (!lineBreak) return null

  const raw = text.slice(1, end)
  const body = stripLeadingBlankLine(after.slice(lineBreak[0].length))
  return { raw, body }
}

function parseFencedFrontMatter(
  text: string,
  fenceRe: RegExp,
  endRe: RegExp,
  format: FrontMatterFormat
): { frontMatter: FrontMatter; body: string } | null {
  if (!fenceRe.test(text)) return null
  const afterFence = text.replace(fenceRe, '')
  const endMatch = endRe.exec(afterFence)
  if (!endMatch || endMatch.index === undefined) return null

  const raw = afterFence.slice(0, endMatch.index)
  const body = stripLeadingBlankLine(afterFence.slice(endMatch.index + endMatch[0].length))

  if (format === 'yaml') {
    try {
      loadYaml(raw)
    } catch {
      // Malformed YAML is still front matter.
    }
  }

  return { frontMatter: { format, raw }, body }
}

export function splitFrontMatter(text: string): { frontMatter: FrontMatter | null; body: string } {
  if (!text) return { frontMatter: null, body: '' }

  const yamlResult = parseFencedFrontMatter(text, YAML_FENCE, YAML_END, 'yaml')
  if (yamlResult) return yamlResult

  const tomlResult = parseFencedFrontMatter(text, TOML_FENCE, TOML_END, 'toml')
  if (tomlResult) return tomlResult

  const jsonResult = parseJsonFrontMatter(text)
  if (jsonResult) {
    return { frontMatter: { format: 'json', raw: jsonResult.raw }, body: jsonResult.body }
  }

  return { frontMatter: null, body: text }
}

export function joinFrontMatter(frontMatter: FrontMatter | null, body: string): string {
  if (!frontMatter) return body

  const fence =
    frontMatter.format === 'yaml'
      ? '---'
      : frontMatter.format === 'toml'
        ? '+++'
        : null

  if (fence) {
    const header = `${fence}\n${frontMatter.raw}\n${fence}`
    if (!body) return `${header}\n`
    return `${header}\n\n${body}`
  }

  // JSON: opening brace is part of the fence; raw excludes it.
  const header = `{${frontMatter.raw}}`
  if (!body) return `${header}\n`
  return `${header}\n\n${body}`
}
