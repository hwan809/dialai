import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { messages, system } = await req.json();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...messages,
    ],
  });

  return NextResponse.json({
    message: response.choices[0].message,
  });
}
