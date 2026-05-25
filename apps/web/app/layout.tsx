import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { SidebarNav } from "@/components/SidebarNav";
import { TopBar } from "@/components/TopBar";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

export const metadata = {
  title: "TrovePilot",
  description: "Autopilot for Bitcoin-backed borrowing on Mezo"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={plusJakarta.className}>
        <Providers>
          <div className="appFrame">
            <SidebarNav />
            <div className="appMain">
              <TopBar />
              <div className="appContent">{children}</div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
