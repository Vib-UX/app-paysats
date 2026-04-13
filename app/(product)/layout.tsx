import { ProductShellEntry } from "./product-shell-entry";

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProductShellEntry>{children}</ProductShellEntry>;
}
