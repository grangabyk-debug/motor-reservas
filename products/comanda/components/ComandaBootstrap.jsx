import styles from "../styles/comanda.module.css";
import { COMANDA_PRODUCT } from "../config";

export default function ComandaBootstrap() {
  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <span className={styles.badge}>Módulo aislado</span>
        <h1>{COMANDA_PRODUCT.name}</h1>
        <p>
          La base técnica de Comanda Llena ya está separada de Habitación Llena.
          Desde acá se van a incorporar mesas, reservas, comandas, caja, impresión,
          stock gastronómico y las integraciones con el PMS.
        </p>
        <div className={styles.status}>Listo para comenzar el desarrollo.</div>
      </section>
    </main>
  );
}
