import { Header } from "@/components/homepage/header";
import { Footer } from "@/components/homepage/footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Clip (not hide) so full-bleed w-screen sections can't add a horizontal
    // scrollbar without breaking the sticky header.
    <div className="bg-primary-foreground min-h-screen overflow-x-clip">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
