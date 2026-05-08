import type { Metadata } from "next";
import { Nunito, Afacad_Flux } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Figma design font — used for all auth page headings, labels, body text
const afacadFlux = Afacad_Flux({
  variable: "--font-afacad",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ascension",
  description: "Screen accountability for men.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} ${afacadFlux.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
