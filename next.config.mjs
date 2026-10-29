// `BUILD_TARGET=android` (set by `npm run build:android`) exports the UI as
// static files for the Capacitor app in android/. That build has no server,
// so the API routes are left out: they are named route.server.js, and only
// the web build lists "server.js" as a page extension.
const isAndroidBuild = process.env.BUILD_TARGET === 'android';

/** @type {import('next').NextConfig} */
const nextConfig = isAndroidBuild
  ? {
      output: 'export',
      images: { unoptimized: true },
      pageExtensions: ['js', 'jsx'],
    }
  : {
      pageExtensions: ['server.js', 'js', 'jsx'],
    };

export default nextConfig;
