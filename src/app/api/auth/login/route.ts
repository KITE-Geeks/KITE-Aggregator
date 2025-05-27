import { NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kitepassword';
const SESSION_COOKIE = 'kite-auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (password === ADMIN_PASSWORD) {
      const sessionData = {
        authenticated: true,
        timestamp: Date.now(),
      };
      
      const response = NextResponse.json({ success: true });
      
      // Set cookie that expires in 7 days
      response.cookies.set({
        name: SESSION_COOKIE,
        value: JSON.stringify(sessionData),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });
      
      return response;
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
