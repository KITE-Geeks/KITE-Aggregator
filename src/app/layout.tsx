'use client';

import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from 'next/navigation';
import ProtectedRoute from "@/components/ProtectedRoute";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Public paths that don't require authentication
const publicPaths = ['/login'];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  return (
    <html lang="en" className="dark">
      <head>
        <title>KITE Aggregator</title>
        <link rel="icon" href="/favicon_crack_light.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <AuthProvider>
          <ConvexClientProvider>
            {isPublicPath ? children : <ProtectedRoute>{children}</ProtectedRoute>}
          </ConvexClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}