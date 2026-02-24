export default function ShareArticleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
