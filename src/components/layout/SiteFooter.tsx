import BrandLogo from "@/components/layout/BrandLogo";

export default function SiteFooter() {
  return (
    <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-dark)] px-6 py-2 flex items-center justify-center gap-2 text-[11px] text-[var(--text-secondary)]">
      <BrandLogo size={14} />
      <span>MC Inventory &middot; UX Technology &middot; v10.5</span>
    </footer>
  );
}
