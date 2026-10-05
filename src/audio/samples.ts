/** Sample files: `data/styles/<id>/assets/<file>` first, then the shared `data/audio/<file>`. Vite turns each into a URL. */
const files = import.meta.glob('../../data/{styles/*/assets,audio}/**/*.{ogg,mp3,wav}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function sampleUrl(styleId: string, file: string): string | undefined {
  return files[`../../data/styles/${styleId}/assets/${file}`] ?? files[`../../data/audio/${file}`];
}
