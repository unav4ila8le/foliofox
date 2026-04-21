import { Header } from "@/components/homepage/header";
import { Footer } from "@/components/homepage/footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-primary-foreground min-h-screen">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
