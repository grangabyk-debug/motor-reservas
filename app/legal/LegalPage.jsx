import Link from"next/link"
import legal from"./legal.module.css"

export default function LegalPage({kicker,title,intro,updated="1 de septiembre de 2026",sections=[]}){
  return <main className={legal.page}>
    <nav className={legal.nav}><Link href="/" className={legal.brand}><span>HL</span><b>Habitación Llena</b><small>Hotel OS</small></Link><div><Link href="/soluciones">Producto</Link><Link href="/privacidad">Privacidad</Link><Link href="/seguridad">Seguridad</Link><Link href="/login">Ingresar</Link></div></nav>
    <header className={legal.hero}><small>{kicker}</small><h1>{title}</h1><p>{intro}</p><span>Última actualización · {updated}</span></header>
    <section className={legal.notice}><b>Documento del producto</b><p>Esta página describe cómo está diseñado el servicio y las reglas operativas previstas. La identificación legal completa del prestador, condiciones comerciales particulares y jurisdicción aplicable se completan en la contratación correspondiente.</p></section>
    <article className={legal.content}>{sections.map((section,index)=><section key={`${section.title}-${index}`}><div><span>{String(index+1).padStart(2,"0")}</span><h2>{section.title}</h2></div>{section.body.map((paragraph,i)=><p key={i}>{paragraph}</p>)}{section.items?.length?<ul>{section.items.map(item=><li key={item}>{item}</li>)}</ul>:null}</section>)}</article>
    <footer className={legal.footer}><div><Link href="/">Habitación Llena</Link><span>Software hotelero diseñado desde la operación real.</span></div><nav><Link href="/privacidad">Privacidad</Link><Link href="/cookies">Cookies</Link><Link href="/terminos">Términos</Link><Link href="/seguridad">Seguridad</Link><a href="mailto:contacto@habitacionllena.com">Contacto</a></nav></footer>
  </main>
}
