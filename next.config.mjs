const isProd = process.env.NODE_ENV === 'production'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isProd ? 'export' : undefined,
  basePath,
  assetPrefix: isProd ? basePath : undefined,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // When run via npx, source files live inside node_modules/control-room/
  // next-swc-loader skips transpilation for node_modules by default, which
  // breaks TypeScript parsing. transpilePackages forces SWC to process them.
  transpilePackages: ['control-room'],
}

export default nextConfig
