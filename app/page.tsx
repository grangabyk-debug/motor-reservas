export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        fontFamily: "Arial, sans-serif",
        background: "#f7f7f5",
        color: "#202020",
      }}
    >
      <div style={{ maxWidth: "700px", textAlign: "center" }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: "700",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          Plataforma hotelera
        </p>

        <h1
          style={{
            fontSize: "56px",
            lineHeight: "1.05",
            margin: "20px 0",
          }}
        >
          Habitación Llena
        </h1>

        <p
          style={{
            fontSize: "20px",
            lineHeight: "1.6",
            color: "#666",
          }}
        >
          Más reservas. Menos complicaciones.
        </p>

        <p style={{ color: "#777", marginTop: "25px" }}>
          Plataforma online de gestión hotelera.
        </p>
      </div>
    </main>
  );
}
