export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}avatar/${path.replace(/^\/+/, '')}`
}
