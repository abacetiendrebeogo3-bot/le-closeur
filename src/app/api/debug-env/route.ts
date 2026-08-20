import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    hasVerifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
    verifyTokenLength: process.env.WHATSAPP_VERIFY_TOKEN ? process.env.WHATSAPP_VERIFY_TOKEN.length : 0,
    hasConfigId: !!process.env.NEXT_PUBLIC_META_CONFIG_ID,
    configIdLength: process.env.NEXT_PUBLIC_META_CONFIG_ID ? process.env.NEXT_PUBLIC_META_CONFIG_ID.length : 0,
    hasAppId: !!process.env.NEXT_PUBLIC_META_APP_ID,
    appIdLength: process.env.NEXT_PUBLIC_META_APP_ID ? process.env.NEXT_PUBLIC_META_APP_ID.length : 0,
  });
}
