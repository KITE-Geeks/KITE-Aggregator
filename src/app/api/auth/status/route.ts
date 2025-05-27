import { NextResponse } from 'next/server';

// This route is not used in static export
// For static export, we'll handle auth status client-side only
export const dynamic = 'force-static';

export function GET() {
  // This route won't be called in static export
  // Client-side will handle auth status using localStorage
  return NextResponse.json({ isAuthenticated: false });
}
