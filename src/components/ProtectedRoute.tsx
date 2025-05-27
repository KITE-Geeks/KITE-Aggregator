'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  loadingComponent = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  ) 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && isClient) {
      // Only redirect if we're not on the login page
      if (!pathname.startsWith('/login')) {
        router.push(`/login?from=${encodeURIComponent(pathname)}`);
      }
    }
  }, [isAuthenticated, isLoading, router, pathname, isClient]);

  // Don't render anything until we're on the client and done checking auth
  if (!isClient || isLoading) {
    return loadingComponent;
  }

  // If not authenticated, we'll redirect in the effect
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
