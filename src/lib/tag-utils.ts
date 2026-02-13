// Generate consistent colors for tags based on their name
export function getTagColor(tag: string): string {
  const colors = [
    'bg-blue-900/50 text-blue-200 border-blue-700',
    'bg-green-900/50 text-green-200 border-green-700',
    'bg-purple-900/50 text-purple-200 border-purple-700',
    'bg-pink-900/50 text-pink-200 border-pink-700',
    'bg-yellow-900/50 text-yellow-200 border-yellow-700',
    'bg-red-900/50 text-red-200 border-red-700',
    'bg-indigo-900/50 text-indigo-200 border-indigo-700',
    'bg-cyan-900/50 text-cyan-200 border-cyan-700',
    'bg-orange-900/50 text-orange-200 border-orange-700',
    'bg-teal-900/50 text-teal-200 border-teal-700',
  ];

  // Simple hash function to consistently map tag names to colors
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
