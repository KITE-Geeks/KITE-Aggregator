import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'kite-auth';

export function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
