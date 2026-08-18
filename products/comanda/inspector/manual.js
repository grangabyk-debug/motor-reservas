export const COMANDA_INSPECTOR_MANUAL = {
  version: "2026-08-18-v1",
  product: "Comanda Llena",
  purpose: "Sistema gastronómico para restaurantes, bares y operación hotelera de alimentos y bebidas.",
  safety: [
    "Comanda Llena vive aislada de Habitación Llena. Nunca reutilizar tablas hoteleras para mesas, comandas, caja, cocina o stock gastronómico.",
    "Una inspección sobre producción debe ser de sólo lectura salvo que exista un entorno de prueba explícito.",
    "El inspector nunca debe afirmar que hizo clic, abrió una mesa, cobró o imprimió si no tiene evidencia real de esa acción.",
    "No inventar stock, precios, ventas, estados de cocina, usuarios ni disponibilidad.",
    "La marca Celíaco es una alerta operativa destacada; no garantiza ausencia de contaminación cruzada."
  ],
  experience: [
    "La operación debe sentirse rápida, simple, clara y usable en pantallas táctiles.",
    "Mobile-first: controles cómodos para el dedo, tipografía legible y sin información innecesaria.",
    "Interfaz formal y moderna; evitar emojis decorativos y ruido visual.",
    "Los botones deben dar feedback visual inmediato y los estados importantes deben distinguirse sin depender sólo del texto.",
    "Un usuario operativo no debería necesitar entender conceptos técnicos de base de datos, API, HTTP o infraestructura."
  ],
  modules: [
    {id:"access", name:"Acceso y puestos", expectations:[
      "Un usuario autenticado debe ver sólo sucursales y puestos permitidos.",
      "La sucursal y el puesto elegidos deben persistir durante la sesión.",
      "Roles elevados pueden administrar; roles operativos deben quedar limitados a su función."
    ]},
    {id:"principal", name:"Principal", expectations:[
      "Debe mostrar el estado operativo esencial sin saturar la pantalla.",
      "Los accesos a venta, caja, menú, cocina y reportes deben ser claros."
    ]},
    {id:"salon", name:"Salón, sectores y mesas", expectations:[
      "Los sectores deben permitir representar un salón real con muchas mesas.",
      "El mapa debe priorizar espacio útil y mesas visualmente compactas.",
      "Una mesa libre se puede abrir con cantidad de comensales y mozo responsable.",
      "No debe permitirse superponer mesas al editar el plano.",
      "Room Service puede representarse como habitación/mesa y conservar su identificación."
    ]},
    {id:"sale", name:"Venta y comanda", expectations:[
      "Agregar un producto debe incorporarlo una sola vez por toque, salvo que la interfaz indique incremento de cantidad.",
      "Las observaciones del producto deben viajar con el ítem.",
      "Una comanda enviada debe conservar mesa, mozo, cantidades, precio y destino de cocina.",
      "Debe ser posible agregar productos luego del primer envío sin perder lo anterior.",
      "Los totales deben coincidir con ítems, descuentos, extras, cargos y pagos."
    ]},
    {id:"menu", name:"Menú y catálogo", expectations:[
      "Categorías y productos tienen vistas Lista y Botones.",
      "Lista prioriza edición rápida de precios y datos; Botones reproduce la experiencia operativa del mozo.",
      "Categorías y productos pueden tener imágenes y existe una biblioteca visual predeterminada para categorías comunes.",
      "Debe contemplar Extras, Hielo, Celíaco y Room Service.",
      "Los productos pueden tener destino de cocina, precio, stock y control de stock."
    ]},
    {id:"celiac", name:"Alerta Celíaco", expectations:[
      "La alerta Celíaco debe verse inmediatamente en la comanda y en cocina.",
      "Debe tener tratamiento visual prioritario.",
      "Nunca debe presentarse como garantía de ausencia de contaminación cruzada."
    ]},
    {id:"kitchen", name:"Cocina / KDS", expectations:[
      "Cada ítem enviado debe llegar a la cocina correspondiente.",
      "Cocina debe poder cambiar estados sin perder el pedido.",
      "Cuando un ítem queda listo, el puesto de mozo/principal debe poder recibir aviso.",
      "Observaciones y alertas críticas deben permanecer visibles durante la preparación."
    ]},
    {id:"cash", name:"Caja y cobros", expectations:[
      "Las operaciones que requieren caja deben vincularse a una caja/sesión válida.",
      "Cobrar no debe duplicar pagos por doble toque.",
      "Cerrar una mesa requiere que el estado económico quede consistente.",
      "Los métodos de pago y movimientos deben quedar trazables."
    ]},
    {id:"room_service", name:"Room Service", expectations:[
      "Puede operar como sector/mesa-habitación.",
      "Puede aplicar cargo configurado como monto fijo o porcentaje.",
      "El cargo debe ser visible antes del cierre y formar parte del total."
    ]},
    {id:"customers", name:"Clientes", expectations:[
      "Los clientes pueden identificarse y conservar datos útiles sin frenar la venta.",
      "Descuentos asociados deben aplicarse de forma explícita y verificable."
    ]},
    {id:"staff", name:"Usuarios y funcionarios", expectations:[
      "Usuarios, funcionarios, sucursales y puestos deben respetar permisos independientes.",
      "Un usuario sin permiso no debe acceder por navegación directa a una función restringida."
    ]},
    {id:"printers", name:"Impresión", expectations:[
      "Impresoras y destinos deben configurarse sin afectar otras sucursales.",
      "Una falla de impresión debe informarse sin perder la comanda.",
      "La reimpresión debe ser intencional para evitar duplicados accidentales."
    ]},
    {id:"reports", name:"Reportes", expectations:[
      "Los reportes deben derivar de datos reales y respetar sucursal, fechas y permisos.",
      "Los totales reportados deben reconciliar con ventas y pagos del mismo alcance."
    ]}
  ],
  inspectionPriorities: [
    "Autenticación y permisos",
    "Carga de la aplicación",
    "Sucursal y puesto activos",
    "Sectores y mesas",
    "Catálogo y precios",
    "Cocinas y KDS",
    "Caja activa",
    "Impresión",
    "Errores visibles o respuestas fallidas",
    "Experiencia móvil"
  ],
  severity: {
    critical: "Impide vender, cobrar, enviar a cocina, protege mal datos o puede perder/duplicar una operación.",
    high: "Rompe un flujo principal o produce información operacional incorrecta.",
    medium: "Hay una alternativa, pero la experiencia o confiabilidad queda degradada.",
    low: "Detalle visual, texto o mejora que no impide operar."
  }
};

export function inspectorManualText(){
  return JSON.stringify(COMANDA_INSPECTOR_MANUAL);
}
