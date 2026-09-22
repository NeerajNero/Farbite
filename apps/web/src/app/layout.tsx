import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Farbite";

export const metadata: Metadata = {
  title: appName,
  description: "Weekend restaurant drops, delivered to your PG gate.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex h-14 w-full max-w-md items-center px-4 sm:max-w-2xl">
            <span className="text-base font-semibold tracking-tight">{appName}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 sm:max-w-2xl">
          {children}
        </main>
      </body>
    </html>
  );
}
