import { Navbar } from '../../components/Navbar';

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <Navbar />
      <main className="flex-1 overflow-hidden touch-none">{children}</main>
    </div>
  );
}
