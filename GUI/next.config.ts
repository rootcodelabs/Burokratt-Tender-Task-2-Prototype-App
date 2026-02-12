import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // API configuration for cookie forwarding through Ruuter
  async rewrites() {
    return [
      {
        source: '/api/s3/:path*',
        destination: `${process.env.NEXT_PUBLIC_RUUTER_PRIVATE_URL || 'http://localhost:8088/s3-testing'}/:path*`,
      },
    ];
  },

  // Headers for CORS and cookie handling
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_RUUTER_PRIVATE_URL || 'http://localhost:8088' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cookie' },
        ],
      },
    ];
  },
};

export default nextConfig;
