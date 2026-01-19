import { Header } from "@/components/homepage/header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-primary-foreground min-h-screen">
      <Header />
      <main>{children}</main>
    </div>
  );
}
