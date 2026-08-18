import ComandaAccessGate from "../../../products/comanda/components/ComandaAccessGate";
import ComandaMobileInspector from "../../../products/comanda/components/ComandaMobileInspector";

export const metadata={
  title:"Inspector | Comanda Llena",
  description:"Chat móvil para hablar con el Inspector IA de Comanda Llena.",
  robots:{index:false,follow:false}
};

export default function Page(){
  return <ComandaAccessGate><ComandaMobileInspector/></ComandaAccessGate>;
}
