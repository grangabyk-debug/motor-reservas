import ComandaBootstrap from "../../products/comanda/components/ComandaBootstrap";

export const metadata = {
  title: "Comanda Llena",
  description: "Sistema de gestión gastronómica y restaurante.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ComandaPage() {
  return <ComandaBootstrap />;
}
