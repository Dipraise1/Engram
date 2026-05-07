/**
 * GET /api/arweave/wallet
 *
 * Authenticated admin endpoint for the current Arweave wallet address/balance.
 * Never returns wallet key material. Generate ARWEAVE_KEY locally and set it as
 * an environment variable instead of moving JWK private keys over HTTP.
 */
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getWalletBalance } from "@/lib/arweave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_TOKEN = process.env.ENGRAM_ADMIN_TOKEN ?? "";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function tokenMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function GET(req: Request) {
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "ENGRAM_ADMIN_TOKEN is not configured on this server." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  if (!tokenMatches(bearerToken(req), ADMIN_TOKEN)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          ...NO_STORE_HEADERS,
          "WWW-Authenticate": "Bearer",
        },
      }
    );
  }

  if (!process.env.ARWEAVE_KEY) {
    return NextResponse.json(
      {
        status: "no_wallet",
        message:
          "No ARWEAVE_KEY is configured. Generate a wallet locally and set the JWK JSON as ARWEAVE_KEY; this endpoint never returns private key material.",
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const { address, ar } = await getWalletBalance();
    return NextResponse.json(
      {
        status: "ok",
        address,
        balance_ar: ar,
        env: process.env.ARWEAVE_ENV ?? "mainnet",
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "error", error: msg },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
