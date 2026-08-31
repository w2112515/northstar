import { NextRequest } from "next/server";

// Runtime proxy to the NorthStar API. API_BASE is read per-request, so the
// same image works locally and on Cloud Run (env var, no build args).
const base = () => process.env.API_BASE ?? "http://localhost:8800";

async function proxy(req: NextRequest, path: string[]) {
  const url = `${base()}/api/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("Content-Type") ?? "application/json",
  };
  // Server-side write guard: the API rejects mutations without this token when
  // deployed publicly. It only ever lives in server env - browsers never see it.
  if (process.env.NORTHSTAR_ADMIN_TOKEN) {
    headers["X-NorthStar-Key"] = process.env.NORTHSTAR_ADMIN_TOKEN;
  }
  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }
  const res = await fetch(url, init);
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
