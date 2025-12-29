import { Header } from "@/components/homepage/header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-primary-foreground">
      <Header />
      <main>{children}</main>
    </div>
  );
}
