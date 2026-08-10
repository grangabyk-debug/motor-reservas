export const metadata = {
  title: "Eliminación de datos | Habitación Llena",
  description:
    "Instrucciones para solicitar la eliminación de datos de Habitación Llena.",
}

export default function DataDeletionPage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "60px 24px",
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.7,
        color: "#1f2937",
      }}
    >
      <h1>Eliminación de datos</h1>

      <p>
        Última actualización: 10 de agosto de 2026
      </p>

      <h2>¿Querés eliminar tus datos?</h2>

      <p>
        Si utilizaste Habitación Llena y querés solicitar la
        eliminación de los datos personales asociados a tu cuenta,
        podés realizar la solicitud por correo electrónico.
      </p>

      <h2>Cómo solicitar la eliminación</h2>

      <ol>
        <li>
          Enviá un correo a
          {" "}
          <a href="mailto:grangabyk@gmail.com">
            grangabyk@gmail.com
          </a>
        </li>

        <li>
          Utilizá como asunto:
          {" "}
          <strong>Solicitud de eliminación de datos</strong>
        </li>

        <li>
          Indicá el correo electrónico asociado a tu cuenta y,
          si corresponde, el establecimiento utilizado en
          Habitación Llena.
        </li>
      </ol>

      <h2>¿Qué información podemos eliminar?</h2>

      <p>
        Según corresponda, la solicitud puede comprender los datos
        personales asociados a la cuenta y la información almacenada
        por Habitación Llena que pueda ser eliminada de acuerdo con
        las obligaciones legales y operativas aplicables.
      </p>

      <h2>Instagram</h2>

      <p>
        Si conectaste una cuenta de Instagram, también podés
        solicitar la desconexión de dicha integración.
      </p>

      <p>
        La desconexión impide que Habitación Llena continúe
        utilizando la autorización asociada a la integración.
      </p>

      <h2>Procesamiento de la solicitud</h2>

      <p>
        Verificaremos la identidad y legitimidad de la solicitud
        antes de realizar una eliminación. Cuando corresponda,
        determinados datos podrán conservarse durante el período
        exigido por obligaciones legales, de seguridad o
        administrativas.
      </p>

      <h2>Contacto</h2>

      <p>
        Para solicitar la eliminación de datos:
      </p>

      <p>
        <a href="mailto:grangabyk@gmail.com">
          grangabyk@gmail.com
        </a>
      </p>
    </main>
  )
}
