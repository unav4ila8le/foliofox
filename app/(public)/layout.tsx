import { Header } from "@/components/homepage/header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/10">
      <Header />
      <main>{children}</main>
    </div>
  );
}
