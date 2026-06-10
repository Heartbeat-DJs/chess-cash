import type { Metadata, Viewport } from "next";
import { SettingsProvider } from "@/context/SettingsContext";
import { AuthProvider } from "@/context/AuthContext";
import NotificationBar from "@/components/layout/NotificationBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChessCash — The Gentleman's Club | Play Chess for Real Money",
  description:
    "Compete in head-to-head chess matches for real cash prizes. 100% skill-based. Premium boards, five house opponents, daily puzzles. Where skill meets stakes.",
  keywords:
    "chess, real money, cash games, skill gaming, chess puzzles, play chess online, chess vs computer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A08",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>♔</text></svg>"
        />
      </head>
      <body>
        <AuthProvider>
          <SettingsProvider>
            {children}
            <NotificationBar />
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
