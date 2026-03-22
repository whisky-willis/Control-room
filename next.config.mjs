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
}

export default nextConfig
