import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const path = formData.get("path") as string;

    if (!file || !path) {
      return NextResponse.json({ error: "Missing file or path" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabaseServer.storage
      .from("product-images")
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true
      });

    if (error) {
      console.error("Storage upload error on server:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseServer.storage
      .from("product-images")
      .getPublicUrl(path);

    return NextResponse.json({ publicUrl });
  } catch (error: any) {
    console.error("Upload error on server:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
