import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { messages, system } = await req.json();

  const response = await getOpenAI().chat.completions.create({
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
