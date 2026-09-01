import LegalPage from"../legal/LegalPage"

export const metadata={title:"Cookies | Habitación Llena",description:"Categorías de cookies y preferencias de Habitación Llena."}

const sections=[
  {title:"Cómo funciona el consentimiento",body:["La landing permite aceptar todas las categorías, mantener sólo las necesarias o elegir preferencias granulares. La elección se guarda en el navegador para no pedirla en cada visita y puede volver a abrirse desde el footer de la página principal."]},
  {title:"Necesarias",body:["Son las que permiten funciones esenciales como seguridad, autenticación, conservación de preferencias técnicas o continuidad de una sesión. No se desactivan desde el panel de consentimiento porque el servicio no podría funcionar correctamente sin ellas."],items:["Sesión y autenticación.","Protección contra abuso y controles de seguridad.","Preferencias estrictamente necesarias para recordar decisiones del usuario."]},
  {title:"Analítica",body:["Sirve para entender uso agregado del sitio y detectar problemas de experiencia. Cuando se incorporen herramientas de analítica no esencial, deberán respetar la preferencia elegida antes de activarse."],items:["Medición de páginas y flujos utilizados.","Diagnóstico de rendimiento o errores de experiencia.","Estadísticas agregadas para mejorar el producto."]},
  {title:"Publicidad",body:["Puede utilizarse para medir campañas o atribuir conversiones comerciales. No es necesaria para usar el PMS y permanece como categoría opcional."],items:["Medición de campañas.","Atribución publicitaria.","Audiencias o remarketing sólo cuando exista una herramienta configurada y consentimiento válido."]},
  {title:"Personalización",body:["Permite recordar elecciones no esenciales de experiencia o adaptar contenido del sitio. No incluye las preferencias indispensables para mantener una sesión o una configuración solicitada del PMS."],items:["Preferencias visuales del sitio comercial.","Contenido o experiencias adaptadas según elecciones previas."]},
  {title:"Cambiar la elección",body:["En la página principal, el enlace “Preferencias de cookies” del footer vuelve a abrir el panel de configuración. También se pueden borrar datos del sitio desde el navegador, lo que hará que el consentimiento vuelva a solicitarse."],items:["Rechazar categorías opcionales no impide usar las funciones esenciales.","Cambiar una preferencia afecta el uso futuro de esa categoría; algunos proveedores pueden requerir además borrar cookies ya almacenadas."]},
]

export default function CookiesPage(){return <LegalPage kicker="COOKIES" title="Elegir debería ser simple." intro="Separamos lo necesario de lo opcional para que cada visitante pueda decidir qué categorías habilitar." sections={sections}/>}
