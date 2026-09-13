/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The Cat Café is a plain static folder in public/, and Next does not
      // resolve a directory to its index.html, so /cafe would 404. This has to
      // be a redirect rather than a rewrite: the game loads its modules and art
      // by relative path, so the browser's URL must actually sit inside /cafe/.
      { source: '/cafe', destination: '/cafe/index.html', permanent: false },
    ];
  },
};

export default nextConfig;
