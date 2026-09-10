import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-postback-secret");

    if (
      !secret ||
      secret !== process.env.AURACAMP_POSTBACK_SECRET
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const conversionId = body.conversion_id;
    const clickId = body.click_id;

    if (!conversionId || !clickId) {
      return NextResponse.json(
        {
          success: false,
          message: "conversion_id and click_id are required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "approve_conversion",
      {
        p_conversion_id: String(conversionId),
        p_click_id: String(clickId),
      }
    );

    if (error) {
      console.error(
        "Postback conversion error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Postback error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Invalid request",
      },
      { status: 400 }
    );
  }
}
