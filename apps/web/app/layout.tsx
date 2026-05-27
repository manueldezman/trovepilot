import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";
import { ToastViewport } from "@/components/ToastViewport";
import { GeistSans } from "geist/font/sans";

export const metadata = {
  title: "TrovePilot",
  description: "Autopilot for Bitcoin-backed borrowing on Mezo"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={GeistSans.variable}>
        <Providers>
          <AppShell>{children}</AppShell>
          <ToastViewport />
        </Providers>
      </body>
    </html>
  );
}
