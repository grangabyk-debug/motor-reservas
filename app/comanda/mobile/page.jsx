import ComandaInspectorGate from "../../../products/comanda/components/ComandaInspectorGate";
import ComandaMobileInspector from "../../../products/comanda/components/ComandaMobileInspector";

export const metadata={
  title:"Inspector | Comanda Llena",
  description:"Chat móvil para hablar con el Inspector IA de Comanda Llena.",
  robots:{index:false,follow:false}
};

export default function Page(){
  return <ComandaInspectorGate><ComandaMobileInspector/></ComandaInspectorGate>;
}
