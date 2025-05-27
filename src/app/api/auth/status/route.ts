import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'kite-auth';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...values] = c.trim().split('=');
        return [key, values.join('=')];
      })
    );
    
    const cookie = cookies[SESSION_COOKIE];
    
    if (!cookie) {
      return NextResponse.json({ isAuthenticated: false });
    }
    
    const session = JSON.parse(decodeURIComponent(cookie));
    const isAuthenticated = session.authenticated === true && 
      (Date.now() - session.timestamp) < (7 * 24 * 60 * 60 * 1000);
    
    return NextResponse.json({ isAuthenticated });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { isAuthenticated: false, error: 'Error checking authentication status' },
      { status: 500 }
    );
  }
}
