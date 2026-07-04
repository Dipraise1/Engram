import type { Metadata } from "next";
import Link from "next/link";
import { DocPage, H1, H2, Lead, P, Code, Table, Note, Ic } from "../ui";
import { minerOpenApi } from "./spec";

export const metadata: Metadata = {
  title: "Miner OpenAPI",
  description:
    "Auto-generated OpenAPI 3 spec for the Engram miner routes, including signed-request and namespace-ownership auth notes.",
  alternates: { canonical: "https://theengram.space/docs/openapi" },
  openGraph: {
    title: "Miner OpenAPI — Engram",
    description: "Generated OpenAPI 3 spec for miner endpoints and auth bodies.",
    url: "https://theengram.space/docs/openapi",
  },
};

const routeRows = Object.entries(minerOpenApi.paths)
  .flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({
      method: method.toUpperCase(),
      path,
      summary: (operation as { summary?: string }).summary ?? "",
      auth: (operation as { "x-engram-auth"?: string })["x-engram-auth"] ?? "public",
    }))
  )
  .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
  .map((row) => [
    <code key={`${row.path}-${row.method}-method`} className="text-[#e040fb] font-mono text-[12px]">
      {row.method}
    </code>,
    <code key={`${row.path}-${row.method}-path`} className="text-[#c4b5d4] font-mono text-[12px]">
      {row.path}
    </code>,
    <span key={`${row.path}-${row.method}-summary`}>{row.summary}</span>,
    <span key={`${row.path}-${row.method}-auth`} className="text-[#8b7a9e]">
      {row.auth}
    </span>,
  ]);

export default function OpenApiPage() {
  return (
    <DocPage
      prev={{ href: "/docs/miner", label: "Run a Miner" }}
      next={{ href: "/docs/architecture", label: "Architecture" }}
      toc={[
        { id: "overview", label: "Overview" },
        { id: "auth", label: "Auth bodies" },
        { id: "routes", label: "Routes" },
        { id: "spec", label: "Generated files" },
      ]}
    >
      <H1>Miner OpenAPI</H1>
      <Lead>Auto-generated OpenAPI 3 spec for the miner route table in <Ic>neurons/miner.py</Ic>.</Lead>

      <H2 id="overview">Overview</H2>
      <P>
        This page is rendered directly from the generated spec. The generator keeps the route list in sync with the
        miner source, so the documentation and the code move together.
      </P>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
        {[
          ["OpenAPI", minerOpenApi.openapi],
          ["Routes", String(Object.keys(minerOpenApi.paths).length)],
          ["Schemas", String(Object.keys(minerOpenApi.components?.schemas ?? {}).length)],
        ].map(([label, value]) => (
          <div key={label} className="p-3 rounded-xl border border-[#1e1525] bg-[#0e0b12]">
            <div className="text-[10px] uppercase tracking-widest text-[#3a2845] font-mono mb-1">{label}</div>
            <div className="text-[13px] text-white font-mono">{value}</div>
          </div>
        ))}
      </div>

      <Note type="tip">
        The miner uses sr25519 signed request bodies for validator-facing endpoints. The canonical message is
        <Ic>{`{nonce}:{endpoint}:{sha256(payload)}`}</Ic>, where the payload excludes <Ic>hotkey</Ic>, <Ic>nonce</Ic>,
        and <Ic>signature</Ic>.
      </Note>

      <H2 id="auth">Auth bodies</H2>
      <Table
        headers={["Type", "When used", "Fields"]}
        rows={[
          [
            "Signed request",
            "Validator-facing ingest/query/challenge/delete/repair endpoints",
            "hotkey, nonce, signature",
          ],
          [
            "Namespace ownership",
            "Private namespace listing, key shares, and namespace attestation",
            "namespace, namespace_hotkey, namespace_sig, namespace_timestamp_ms",
          ],
          ["Localhost only", "Metrics and wallet stats", "Loopback access"],
        ]}
      />

      <H2 id="routes">Routes</H2>
      <Table
        headers={["Method", "Path", "Summary", "Auth"]}
        rows={routeRows}
      />

      <H2 id="spec">Generated files</H2>
      <P>
        The spec is written to <Ic>engram-web/public/openapi/miner.openapi.json</Ic> and mirrored into{" "}
        <Ic>engram-web/app/docs/openapi/spec.ts</Ic> for the rendered docs page.
      </P>
      <Code lang="bash">{`python scripts/generate_miner_openapi.py
python scripts/generate_miner_openapi.py --check`}</Code>
      <P>
        You can also open the JSON directly at{" "}
        <Link href="/openapi/miner.openapi.json" className="text-[#e040fb] hover:underline">
          /openapi/miner.openapi.json
        </Link>
        .
      </P>
    </DocPage>
  );
}
