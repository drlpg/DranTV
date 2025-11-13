/** @type {import('next').NextConfig} */
/* eslint-disable @typescript-eslint/no-var-requires */

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  output: 'standalone',
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true, // 始终在构建时忽略 ESLint 错误
  },

  reactStrictMode: false,
  swcMinify: true, // 启用 SWC 压缩以提升性能

  // 开发环境性能优化
  typescript: isDev
    ? {
        ignoreBuildErrors: true,
      }
    : undefined,

  devIndicators: isDev
    ? {
        buildActivity: false, // 禁用构建指示器
        buildActivityPosition: 'bottom-right',
      }
    : undefined,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com blob: data:",
              "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com https://static.cloudflareinsights.com blob: data:",
              "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              "style-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              "img-src * 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src * 'self' blob: data:",
              "media-src * 'self' blob: data:",
              "frame-src 'self' https://challenges.cloudflare.com",
              "frame-ancestors 'self'",
              "worker-src 'self' blob:",
              "child-src 'self' blob: https://challenges.cloudflare.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  experimental: {
    instrumentationHook: process.env.NODE_ENV === 'production',
    // 优化包导入
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },

  // 优化编译性能
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },

  // Uncoment to add domain whitelist
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  webpack(config, { dev, isServer }) {
    // 开发环境性能优化
    if (dev) {
      // 禁用源码映射以加快编译
      config.devtool = 'eval-cheap-module-source-map';

      // 优化缓存
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
    }

    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg')
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: { not: /\.(css|scss|sass)$/ },
        resourceQuery: { not: /url/ }, // exclude if *.svg?url
        loader: '@svgr/webpack',
        options: {
          dimensions: false,
          titleProp: true,
        },
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    // Add alias configuration to ensure proper path resolution in Docker builds
    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'public'),
    };

    // Ensure proper file extension resolution
    config.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];

    // Add TypeScript module resolution support
    config.resolve.modules = [path.resolve(__dirname, 'src'), 'node_modules'];

    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      crypto: false,
    };

    return config;
  },
};

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA(nextConfig);
