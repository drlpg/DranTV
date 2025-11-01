/** @type {import('next').NextConfig} */
/* eslint-disable @typescript-eslint/no-var-requires */

const nextConfig = {
  output: 'standalone',
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true, // 始终在构建时忽略 ESLint 错误
  },

  reactStrictMode: false,
  swcMinify: true,

  // 禁用图片警告
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  experimental: {
    instrumentationHook: process.env.NODE_ENV === 'production',
    optimizePackageImports: [
      'lucide-react',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      'framer-motion',
      'react-icons',
    ],
    // optimizeCss 需要 critters 依赖，暂时禁用
    // optimizeCss: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 启用编译器优化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 图片优化配置
  images: {
    unoptimized: false, // 启用图片优化
    formats: ['image/webp', 'image/avif'], // 支持现代图片格式
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840], // 响应式图片尺寸
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // 图标等小图片尺寸
    minimumCacheTTL: 60 * 60 * 24 * 30, // 缓存30天
    dangerouslyAllowSVG: true, // 允许SVG
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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

  // 优化开发环境性能
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // 优化生产构建
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // 优化字体加载
  optimizeFonts: true,

  // 添加响应头以支持视频播放和CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Range, Origin, Accept',
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
          },
        ],
      },
    ];
  },

  webpack(config, { dev, isServer }) {
    // 启用持久化缓存以加快构建速度
    if (!isServer) {
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
