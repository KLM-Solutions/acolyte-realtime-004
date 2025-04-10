import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: { 
            message: "OpenAI API key not configured", 
            type: "server_error" 
          } 
        },
        { status: 500 }
      );
    }
    
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "verse",
        }),
      },
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { 
        error: { 
          message: error.message || "Failed to generate token", 
          type: "server_error" 
        } 
      },
      { status: 500 }
    );
  }
}
