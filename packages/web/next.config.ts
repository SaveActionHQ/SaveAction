import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Redirect old dashboard routes to new project-scoped routes
  async redirects() {
    return [
      // Old flat routes → projects list (project selection required)
      {
        source: '/dashboard',
        destination: '/projects',
        permanent: true,
      },
      {
        source: '/recordings',
        destination: '/projects',
        permanent: true,
      },
      {
        source: '/recordings/:id',
        destination: '/projects',
        permanent: false,
      },
      {
        source: '/runs',
        destination: '/projects',
        permanent: true,
      },
      {
        source: '/runs/new',
        destination: '/projects',
        permanent: true,
      },
      {
        source: '/runs/:id',
        destination: '/projects',
        permanent: false,
      },
      {
        source: '/schedules',
        destination: '/projects',
        permanent: true,
      },
      {
        source: '/schedules/:id',
        destination: '/projects',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
