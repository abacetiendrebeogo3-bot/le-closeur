import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  return NextResponse.json({
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    prefix: token ? token.substring(0, 3) : "",
    suffix: token ? token.substring(token.length - 3) : "",
  });
}
