import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { BoardListClient } from '@/components/board/BoardListClient';
import { useAuth } from '@/components/AuthProvider';

export default function BoardListPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#15130f] text-gray-400">
        Loading…
      </div>
    );
  }

  return <BoardListClient />;
}
