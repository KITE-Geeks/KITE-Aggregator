"use client";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simple layout without sidebar - navigation is now on main page
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}