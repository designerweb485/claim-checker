import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claim Checker",
  description:
    "Validate synthetic X12 837 Professional claims. Not a HIPAA or X12 certification product.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
