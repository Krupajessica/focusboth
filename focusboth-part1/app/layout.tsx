import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CompassStoreProvider } from "@/components/compass-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "FocusBoth — Work and life on one clock",
  description: "Visa-aware planning that also protects student wellbeing, hobbies, and personal growth.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <CompassStoreProvider>
          <AppShell>{children}</AppShell>
        </CompassStoreProvider>
      </body>
    </html>
  );
}
