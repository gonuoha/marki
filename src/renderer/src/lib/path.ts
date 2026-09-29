export function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? normalized : normalized.slice(idx + 1)
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return normalized.startsWith('/') ? '/' : '.'
  return normalized.slice(0, idx)
}

export function join(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
}

export function parentPath(path: string): string {
  return dirname(path)
}
