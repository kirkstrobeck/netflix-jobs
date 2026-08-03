import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Careers at Netflix",
  description: "Careers at Netflix",
  openGraph: {
    title: "Careers at Netflix",
    description: "Careers at Netflix",
    siteName: "Careers at Netflix",
    url: "http://explore.jobs.netflix.net/careers",
    images: [
      {
        url: "https://static.vscdn.net/images/careers/demo/netflix/1726216733::NetflixPageImage.jpg",
        width: 220,
        height: 109,
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function Base({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="h-full bg-black" lang="en">
      <body className="min-h-full bg-black">{children}</body>
    </html>
  );
}
