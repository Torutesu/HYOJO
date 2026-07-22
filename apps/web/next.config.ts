import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@hyojo/adaptive-ui", "@hyojo/domain", "@hyojo/ui"],
  outputFileTracingRoot: path.join(process.cwd(), "../..")
};

export default nextConfig;
