import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_COOKIE = 'kite-auth';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (password === PASSWORD) {
      // In a real app, use a proper session management system
      const sessionData = {
        authenticated: true,
        timestamp: Date.now(),
      };
      
      // Set a cookie that expires in 7 days
      cookies().set(SESSION_COOKIE, JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid password' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
