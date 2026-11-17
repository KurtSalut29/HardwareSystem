import type { Metadata, Viewport } from "next";
import { Inter, Archivo } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { STORE_NAME } from "@/lib/brand";
import PwaSetup from "@/components/pwa/PwaSetup";
import SystemFeedback from "@/components/SystemFeedback";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: STORE_NAME,
  description: `${STORE_NAME} — hardware store management system`,
  applicationName: STORE_NAME,
  // Installed on iPhone/iPad: full-screen app with the store's name and icon.
  appleWebApp: { capable: true, title: STORE_NAME, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1020" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${archivo.variable} antialiased`}>
        <PwaSetup />
        <ThemeProvider>
          <ToastProvider><SystemFeedback />{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
