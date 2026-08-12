"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
import styles from "../styles/comanda-v1.module.css";

export default function ComandaAuth({mode="login"}){
  const register=mode==="register";
  const [business,setBusiness]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [kind,setKind]=useState("error");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{(async()=>{try{const {data}=await supabase.auth.getUser();if(data?.user){window.location.href="/comanda/onboarding"}}catch{}})()},[]);

  async function submit(e){
    e.preventDefault();setBusy(true);setMessage("");
    try{
      if(register){
        const {data,error}=await supabase.auth.signUp({
          email:email.trim(),password,
          options:{data:{product:"comanda",business_name:business.trim()},emailRedirectTo:`${window.location.origin}/comanda/onboarding`}
        });
        if(error) throw error;
        localStorage.setItem("comanda_pending_business",business.trim());
        if(data?.session){
          const {error:bootError}=await supabase.rpc("comanda_bootstrap_account",{p_name:business.trim()});
          if(bootError) throw bootError;
          window.location.href="/comanda/onboarding";return;
        }
        setKind("success");setMessage("Cuenta creada. Revisá tu email para confirmar el acceso y después continuá con la configuración.");
      }else{
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
        window.location.href="/comanda/onboarding";
      }
    }catch(err){
      setKind("error");
      setMessage(err?.message==="Invalid login credentials"?"Email o contraseña incorrectos.":err?.message||"No pudimos completar la operación.");
    }finally{setBusy(false)}
  }

  async function reset(){
    if(!email.trim()){setKind("error");setMessage("Ingresá tu email primero.");return}
    setBusy(true);
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/reset-password`});
    setBusy(false);
    if(error){setKind("error");setMessage(error.message)}else{setKind("success");setMessage("Te enviamos un email para recuperar la contraseña.")}
  }

  return <main className={`${styles.page} ${styles.authPage}`}>
    <section className={styles.authSide}>
      <Link href="/comanda" className={styles.brand} style={{color:"white"}}><span className={styles.brandMark}>C</span>Comanda Llena</Link>
      <div><span className={styles.eyebrow}>{register?"14 días de prueba":"Bienvenido de nuevo"}</span><h2>{register?"Tu restaurante ordenado desde el primer turno.":"Volvé a tu salón, cocina y caja."}</h2><p>{register?"El onboarding crea una base inicial y después te guía para adaptar sucursales, funcionarios, mesas, carta y caja a tu operación real.":"Ingresá con tu cuenta de Comanda Llena. La sesión y los datos gastronómicos se mantienen separados del PMS hotelero."}</p></div>
      <small style={{color:"#8fa8a0"}}>Desktop-first · Mouse y teclado · Compatible con tablets</small>
    </section>
    <section className={styles.authFormWrap}>
      <div className={styles.authCard}>
        <Link href="/comanda" className={styles.brand}><span className={styles.brandMark}>C</span>Comanda Llena</Link>
        <h1>{register?"Crear cuenta":"Ingresar"}</h1>
        <p className={styles.muted}>{register?"Probalo gratis durante 14 días.":"Accedé a tu operación gastronómica."}</p>
        <form className={styles.form} onSubmit={submit}>
          {register&&<label className={styles.label}>Nombre del negocio<input className={styles.input} required minLength={2} value={business} onChange={e=>setBusiness(e.target.value)} placeholder="Mi restaurante"/></label>}
          <label className={styles.label}>Email<input className={styles.input} type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/></label>
          <label className={styles.label}>Contraseña<input className={styles.input} type="password" required minLength={8} autoComplete={register?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></label>
          {message&&<div className={`${styles.message} ${kind==="success"?styles.success:styles.error}`}>{message}</div>}
          <button className={styles.primary} disabled={busy} type="submit">{busy?"Procesando...":register?"Crear cuenta y empezar":"Ingresar"}</button>
        </form>
        {!register&&<button className={styles.ghost} style={{width:"100%",marginTop:10}} onClick={reset} disabled={busy}>¿Olvidaste tu contraseña?</button>}
        <p className={styles.authBottom}>{register?<>¿Ya tenés cuenta? <Link href="/comanda/login">Ingresar</Link></>:<>¿Todavía no tenés cuenta? <Link href="/comanda/registro">Probar 14 días</Link></>}</p>
      </div>
    </section>
  </main>
}