import { NextResponse } from 'next/server';

const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_COOKIE = 'kite-auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (password === PASSWORD) {
      // In a real app, use a proper session management system
      const sessionData = {
        authenticated: true,
        timestamp: Date.now(),
      };
      
      // Create response with success message
      const response = NextResponse.json({ success: true });
      
      // Set cookie in the response
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
