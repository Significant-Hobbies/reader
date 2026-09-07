export function accountArticleKey(user: { id: string | null } | null, id: string | undefined) {
  return ['article', user?.id, id] as const;
}
