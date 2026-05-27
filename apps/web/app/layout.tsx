import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { SidebarNav } from "@/components/SidebarNav";
import { TopBar } from "@/components/TopBar";
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
          <div className="appFrame">
            <SidebarNav />
            <div className="appMain">
              <TopBar />
              <div className="appContent">{children}</div>
            </div>
          </div>
          <ToastViewport />
        </Providers>
      </body>
    </html>
  );
}
