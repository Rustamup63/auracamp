import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

function getParam(req: NextRequest, names: string[]) {
  const url = new URL(req.url);

  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value?.trim()) return value.trim();
  }

  return null;
}

export async function GET(req: NextRequest) {
  return handlePostback(req);
}

export async function POST(req: NextRequest) {
  return handlePostback(req);
}

async function handlePostback(req: NextRequest) {
  try {
    const secret = process.env.AURACAMP_POSTBACK_SECRET;

    if (!secret) {
      return NextResponse.json(
        { success: false, error: "Postback secret is not configured" },
        { status: 500 }
      );
    }

    const receivedSecret =
  req.headers.get("x-auracamp-secret") ||
  getParam(req, ["secret", "token", "key"]) ||
  "";

    if (receivedSecret !== secret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const clickId = getParam(req, [
      "click_id",
      "clickid",
      "subid",
      "sub_id",
    ]);

    const conversionId = getParam(req, [
      "conversion_id",
      "conversionid",
      "transaction_id",
      "transactionid",
      "lead_id",
      "event_id",
    ]);

    if (!clickId) {
      return NextResponse.json(
        { success: false, error: "Missing click_id" },
        { status: 400 }
      );
    }

    if (!conversionId) {
      return NextResponse.json(
        { success: false, error: "Missing conversion_id" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);

    const postbackData = Object.fromEntries(
      url.searchParams.entries()
    );

    const { data, error } = await supabase.rpc(
      "process_postback",
      {
        p_click_id: clickId,
        p_conversion_id: conversionId,
        p_postback_data: postbackData,
      }
    );

    if (error) {
      console.error("Postback RPC error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Postback processing failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Postback error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
