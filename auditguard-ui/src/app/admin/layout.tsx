import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import { QueryProvider } from '@/components/admin/QueryProvider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
