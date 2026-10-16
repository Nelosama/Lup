import { writeFile } from "node:fs/promises";
const origin = new URL(process.argv[2] ?? "");
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error(
    "Pass only the HTTPS origin of your authorized backend deployment",
  );
const headers = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: https://*.supabase.co; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
];
await writeFile(
  new URL("../frontend/vercel.json", import.meta.url),
  JSON.stringify(
    {
      buildCommand: "npm run build -w frontend",
      outputDirectory: "dist",
      installCommand: "npm ci --prefix ..",
      rewrites: [
        { source: "/api/:path*", destination: `${origin.origin}/api/:path*` },
        { source: "/:path*", destination: "/index.html" },
      ],
      headers: [{ source: "/(.*)", headers }],
    },
    null,
    2,
  ) + "\n",
);
console.log("Vercel configuration written. No deployment performed.");
