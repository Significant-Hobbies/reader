export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <main className="flex-1 overflow-hidden touch-none">{children}</main>
    </div>
  );
}
