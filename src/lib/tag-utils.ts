// Generate consistent colors for tags based on their name
export function getTagColor(tag: string): string {
  const colors = [
    'bg-zinc-900 text-zinc-300 border-zinc-700',
    'bg-zinc-950 text-zinc-300 border-zinc-700',
    'bg-zinc-900/80 text-zinc-400 border-zinc-800',
  ];

  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
