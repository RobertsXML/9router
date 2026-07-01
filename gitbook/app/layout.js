import { Inter } from "next/font/google";
import { DOCS_CONFIG } from "@/constants/docsConfig";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: DOCS_CONFIG.title,
  description: DOCS_CONFIG.description,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`bg-[#FCFBF9] text-[#6B7280] ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
