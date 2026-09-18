import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./skills/**/*.md"],
  },
};

export default nextConfig;
