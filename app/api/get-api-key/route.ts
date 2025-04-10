import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OpenAI API key not configured in environment variables");
      return NextResponse.json(
        { 
          error: "OpenAI API key not configured" 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ apiKey });
  } catch (error: any) {
    console.error("Error retrieving API key:", error);
    return NextResponse.json(
      { 
        error: error.message || "Failed to retrieve API key"
      },
      { status: 500 }
    );
  }
} 