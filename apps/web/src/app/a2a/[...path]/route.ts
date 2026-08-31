import { NextRequest } from "next/server";

// Pass-through for the A2A weather agent (agent card + JSON-RPC). Same
// API_BASE as the /api proxy; no admin token - the A2A surface is read-only
// by design and stays open so other agents (and judges) can talk to it.
const base = () => process.env.API_BASE ?? "http://localhost:8800";

async function proxy(req: NextRequest, path: string[]) {
  const url = `${base()}/a2a/${path.join("/")}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": req.headers.get("Content-Type") ?? "application/json" },
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

export async function GET(req: NextRequest, ctx: RouteContext<"/a2a/[...path]">) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/a2a/[...path]">) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
