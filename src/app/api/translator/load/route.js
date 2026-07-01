import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Security: only allow specific filenames
const allowedFiles = [
  "1_req_client.json",
  "2_req_source.json",
  "3_req_openai.json",
  "4_req_target.json",
  "5_res_provider.txt",
  "6_res_openai.txt",
  "7_res_client.txt",
  "7_res_client.json",
];

const LOGS_DIR = path.join(process.cwd(), "logs", "translator");

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file");

    if (!file) {
      return NextResponse.json({ success: false, error: "File parameter required" }, { status: 400 });
    }

    if (!allowedFiles.includes(file)) {
      return NextResponse.json({ success: false, error: "Invalid file name" }, { status: 400 });
    }

    const filePath = path.join(LOGS_DIR, file);

    // Read file (async)
    let content;
    try {
      // eslint-disable-next-line react-doctor/server-hoist-static-io -- filePath depends on request query param
      content = await fs.readFile(filePath, "utf-8");
    } catch (err) {
      if (err.code === "ENOENT") {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error("Error loading file:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
