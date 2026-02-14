// Suggested categories for articles
export const SUGGESTED_CATEGORIES = [
  'Research',
  'Tutorial',
  'Blog Post',
  'Documentation',
  'News',
  'Case Study',
  'Interview',
  'Opinion',
  'Guide',
  'Review',
];

// Generate consistent colors for categories based on their name
// Returns a color name that can be used with badge variants
export function getCategoryColor(category: string): string {
  const colors = ['blue', 'cyan', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo'];

  // Simple hash function to consistently map category names to colors
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
