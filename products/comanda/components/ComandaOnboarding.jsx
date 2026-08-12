"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
import styles from "../styles/comanda-v1.module.css";

export default function ComandaOnboarding(){
  const [loading,setLoading]=useState(true);
  const [account,setAccount]=useState(null);
  const [counts,setCounts]=useState({staff:0,tables:0,products:0,registers:0});
  const [business,setBusiness]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function load(){
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){window.location.href="/comanda/login";return}
      const {data:accounts,error}=await supabase.from("comanda_accounts").select("*").order("created_at").limit(1);
      if(error) throw error;
      const a=accounts?.[0]||null;setAccount(a);
      if(!a){setBusiness(localStorage.getItem("comanda_pending_business")||"");setLoading(false);return}
      const [staff,tables,products,registers]=await Promise.all([
        supabase.from("comanda_staff").select("id",{count:"exact",head:true}).eq("account_id",a.id).eq("active",true),
        supabase.from("comanda_tables").select("id",{count:"exact",head:true}).eq("account_id",a.id).eq("active",true),
        supabase.from("comanda_products").select("id",{count:"exact",head:true}).eq("account_id",a.id).eq("active",true),
        supabase.from("comanda_cash_registers").select("id",{count:"exact",head:true}).eq("account_id",a.id).eq("active",true),
      ]);
      setCounts({staff:staff.count||0,tables:tables.count||0,products:products.count||0,registers:registers.count||0});
    }catch(e){setMessage(e.message||"No pudimos cargar el onboarding.")}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  async function createBase(e){
    e.preventDefault();if(business.trim().length<2)return;
    setBusy(true);setMessage("");
    const {error}=await supabase.rpc("comanda_bootstrap_account",{p_name:business.trim()});
    setBusy(false);
    if(error){setMessage(error.message);return}localStorage.removeItem("comanda_pending_business");await load();
  }

  const steps=useMemo(()=>[
    ["Negocio y sucursal",!!account,account?`${account.name} · base creada`:"Creá la cuenta operativa del restaurante."],
    ["Equipo y roles",counts.staff>0,`${counts.staff} funcionario${counts.staff===1?"":"s"} configurados`],
    ["Sectores y mesas",counts.tables>0,`${counts.tables} mesa${counts.tables===1?"":"s"} listas para editar`],
    ["Carta y productos",counts.products>0,`${counts.products} producto${counts.products===1?"":"s"} de ejemplo`],
    ["Caja",counts.registers>0,`${counts.registers} caja${counts.registers===1?"":"s"} disponible`],
  ],[account,counts]);
  const done=steps.filter(s=>s[1]).length;
  const days=account?Math.max(0,Math.ceil((new Date(account.trial_ends_at)-new Date())/86400000)):14;

  if(loading)return <main className={styles.onboardingPage}><div className={styles.onboardingWrap}>Preparando Comanda Llena...</div></main>;
  if(!account)return <main className={styles.onboardingPage}><div className={styles.onboardingWrap}>
    <Link href="/comanda" className={styles.brand}><span className={styles.brandMark}>C</span>Comanda Llena</Link>
    <div className={styles.authCard} style={{margin:"70px auto"}}><span className={styles.eyebrow}>Paso 1 de 5</span><h1>Creemos tu restaurante</h1><p className={styles.muted}>Vamos a generar una sucursal Central, una caja, un salón, mesas y productos de ejemplo. Después podés cambiar todo.</p><form className={styles.form} onSubmit={createBase}><label className={styles.label}>Nombre del negocio<input className={styles.input} value={business} onChange={e=>setBusiness(e.target.value)} minLength={2} required placeholder="Mi restaurante"/></label>{message&&<div className={`${styles.message} ${styles.error}`}>{message}</div>}<button className={styles.primary} disabled={busy}>{busy?"Creando...":"Crear base inicial"}</button></form></div>
  </div></main>;

  return <main className={styles.onboardingPage}><div className={styles.onboardingWrap}>
    <div className={styles.onboardingHeader}><div><Link href="/comanda" className={styles.brand}><span className={styles.brandMark}>C</span>Comanda Llena</Link><h1>Dejá tu operación lista</h1><p className={styles.muted}>Ya preparamos una base funcional. Revisá cada bloque y adaptalo a tu restaurante.</p></div><Link href="/comanda/app" className={styles.primary}>Entrar al sistema</Link></div>
    <div className={styles.progress}><div className={styles.progressBar} style={{width:`${done/steps.length*100}%`}}/></div>
    <div className={styles.steps}>{steps.map(([title,ok,text],i)=><article key={title} className={styles.stepCard}><div className={`${styles.stepNumber} ${ok?styles.stepDone:""}`}>{ok?"✓":i+1}</div><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    <div className={styles.trialBox}><div><small>PRUEBA ACTIVA</small><br/><strong>{days} días restantes</strong></div><div style={{textAlign:"right"}}><div>Podés usar todas las funciones de esta primera versión.</div><small style={{color:"#9db3ac"}}>Después Central Llena podrá controlar trial, pagos y suspensión.</small></div></div>
    <div className={styles.helpGrid} style={{marginTop:18}}>
      <article className={styles.helpCard}><h3>🪑 Editor de mesas</h3><p>Entrá a Configuración → Mesas para agregar sectores, crear mesas y moverlas de posición.</p></article>
      <article className={styles.helpCard}><h3>🍽️ Primera venta</h3><p>Abrí una mesa desde Salón, elegí funcionario, agregá productos y enviá la comanda a Cocina.</p></article>
      <article className={styles.helpCard}><h3>💬 ¿Necesitás ayuda?</h3><p>Podemos acompañarte en la configuración inicial.</p><a className={styles.secondary} href="https://wa.me/5491159609135?text=Hola%2C%20necesito%20ayuda%20para%20configurar%20Comanda%20Llena" target="_blank" rel="noreferrer">Hablar con soporte</a></article>
    </div>
  </div></main>
}