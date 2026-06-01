/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: [],
  },
  experimental: {
    typedRoutes: false,
  },
}

export default nextConfig
