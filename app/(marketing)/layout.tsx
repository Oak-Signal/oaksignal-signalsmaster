import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      {/* PageTransition disabled: AnimatePresence duplicates children and gets
          stuck at opacity:0 under React Strict Mode (dev), blanking pages. */}
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
