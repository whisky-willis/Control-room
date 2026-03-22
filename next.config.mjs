import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  // When run via npx, source files live inside node_modules/control-room/.
  // transpilePackages forces SWC to process them (otherwise next-swc-loader
  // skips TS transpilation for anything under node_modules/).
  transpilePackages: ['control-room'],
  webpack(config) {
    // Explicitly map @/ to the src directory so path aliases resolve correctly
    // when the app runs from inside node_modules (e.g. via npx).
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },
}

export default nextConfig
