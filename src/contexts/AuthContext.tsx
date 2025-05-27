'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AUTH_KEY = 'kite-auth';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is authenticated on initial load
    const checkAuth = () => {
      try {
        const authData = localStorage.getItem(AUTH_KEY);
        if (authData) {
          const session = JSON.parse(authData);
          const isValidSession = session.authenticated === true && 
            (Date.now() - session.timestamp) < (7 * 24 * 60 * 60 * 1000);
          
          setIsAuthenticated(isValidSession);
          
          // Redirect to login if not authenticated and not already on login page
          if (!isValidSession && !pathname.startsWith('/login')) {
            localStorage.removeItem(AUTH_KEY);
            router.push(`/login?from=${encodeURIComponent(pathname)}`);
          } else if (isValidSession && pathname === '/login') {
            // If already authenticated and on login page, redirect to home
            router.push('/');
          }
        } else if (!pathname.startsWith('/login')) {
          router.push(`/login?from=${encodeURIComponent(pathname)}`);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
        if (!pathname.startsWith('/login')) {
          router.push(`/login?from=${encodeURIComponent(pathname)}`);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  const login = async (password: string): Promise<boolean> => {
    try {
      // In a real app, you would validate the password with your backend
      // For demo purposes, we'll just check if any password is provided
      if (!password) return false;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create session
      const sessionData = {
        authenticated: true,
        timestamp: Date.now(),
      };
      
      // Store session in localStorage
      localStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
      setIsAuthenticated(true);
      
      // Redirect to the requested page or home
      const { from } = JSON.parse(localStorage.getItem('auth_redirect') || '{}');
      router.push(from || '/');
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem(AUTH_KEY);
      setIsAuthenticated(false);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Don't show loading state for static export
  if (isLoading && typeof window === 'undefined') {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
