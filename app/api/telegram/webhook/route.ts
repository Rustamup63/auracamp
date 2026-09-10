import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Telegram environment variables are missing" },
      { status: 500 }
    );
  }

  const secret = request.headers.get(
    "x-telegram-bot-api-secret-token"
  );

  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await request.json();

  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = message?.text;

  if (!chatId) {
    return NextResponse.json({ ok: true });
  }

  if (text === "/start") {
    await sendMessage(
      chatId,
      "👋 Welcome to AURACAMP Support!\n\nHow can we help you?\n\n🎫 Create Support Ticket\n💬 Contact Support"
    );
  } else {
    await sendMessage(
      chatId,
      "📩 Your message has been received.\n\nOur support team will get back to you soon."
    );
  }

  return NextResponse.json({ ok: true });
}

async function sendMessage(chatId: number, text: string) {
  await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );
}
