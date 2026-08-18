"use client";

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabase";
import ComandaArt,{resolveCategoryArt,resolveProductArt} from "./ComandaArt";
import ui from "../styles/comanda-polish.module.css";

const money=(value)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value||0));

function clickLegacy(rootRef,label){
  const buttons=[...rootRef.current?.querySelectorAll("button")||[]];
  const exact=buttons.find(b=>b.textContent?.trim()===label);
  if(exact)exact.click();
}

function ArtBox({item,category,isCategory=false}){
  const image=item?.image_url;
  const kind=isCategory?resolveCategoryArt(item):resolveProductArt(item,category);
  return <div className={`${ui.visualArtBox} ${isCategory?ui.visualArtCategory:""}`}>
    {image?<img src={image} alt="" loading="lazy"/>:<ComandaArt kind={kind} className={ui.visualArt}/>} 
  </div>;
}

export default function ComandaVisualMenu({rootRef,branchId,onNotice}){
  const [categories,setCategories]=useState([]);
  const [products,setProducts]=useState([]);
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [categoryMode,setCategoryMode]=useState("buttons");
  const [productMode,setProductMode]=useState("buttons");

  useEffect(()=>{
    let active=true;
    (async()=>{
      if(!branchId)return;
      setLoading(true);
      const [{data:cats,error:ce},{data:prods,error:pe}]=await Promise.all([
        supabase.from("comanda_categories").select("*").eq("branch_id",branchId).eq("active",true).order("sort_order").order("name"),
        supabase.from("comanda_products").select("*").eq("active",true).order("sort_order").order("name")
      ]);
      if(!active)return;
      if(ce||pe){onNotice?.(ce?.message||pe?.message||"No se pudo cargar el menú");setLoading(false);return;}
      const c=cats||[],p=prods||[];
      setCategories(c);setProducts(p);setSelected(prev=>prev&&c.some(x=>x.id===prev)?prev:c[0]?.id||null);setLoading(false);
    })();
    return()=>{active=false};
  },[branchId]);

  const selectedCategory=categories.find(x=>x.id===selected)||null;
  const visibleProducts=useMemo(()=>{
    const q=search.toLowerCase().trim();
    return products.filter(p=>(!selected||p.category_id===selected)&&(!q||`${p.public_name||p.name} ${p.sku||""}`.toLowerCase().includes(q)));
  },[products,selected,search]);

  return <section className={ui.visualMenuStage}>
    <header className={ui.visualMenuHeader}>
      <div><span className={ui.visualEyebrow}>CARTA OPERATIVA</span><h1>Menú</h1><p>Categorías y productos visuales para comandar más rápido.</p></div>
      <div className={ui.visualHeaderActions}><button className={ui.secondaryButton} onClick={()=>clickLegacy(rootRef,"Nueva categoría")}>Nueva categoría</button><button className={ui.primaryButton} onClick={()=>clickLegacy(rootRef,"Nuevo producto")}>Nuevo producto</button></div>
    </header>

    <div className={ui.visualTabs}>
      <button className={ui.visualTabActive}>Productos</button>
      <button onClick={()=>clickLegacy(rootRef,"Opciones")}>Opciones</button>
      <button onClick={()=>clickLegacy(rootRef,"Combos")}>Combos</button>
      <button onClick={()=>clickLegacy(rootRef,"Ingredientes")}>Ingredientes</button>
    </div>

    <div className={ui.visualToolbar}>
      <div className={ui.visualSearchWrap}><input className={ui.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto o código…"/><span>{visibleProducts.length} productos</span></div>
      <div className={ui.viewSwitch}><span>Categorías</span><button className={categoryMode==="buttons"?ui.viewActive:""} onClick={()=>setCategoryMode("buttons")}>Botones</button><button className={categoryMode==="list"?ui.viewActive:""} onClick={()=>setCategoryMode("list")}>Lista</button></div>
      <div className={ui.viewSwitch}><span>Productos</span><button className={productMode==="buttons"?ui.viewActive:""} onClick={()=>setProductMode("buttons")}>Botones</button><button className={productMode==="list"?ui.viewActive:""} onClick={()=>setProductMode("list")}>Lista</button></div>
    </div>

    {loading?<div className={ui.visualLoading}>Cargando menú…</div>:<>
      {categoryMode==="buttons"?<div className={ui.visualCategoryGrid}>{categories.map(cat=><button key={cat.id} className={`${ui.visualCategoryCard} ${selected===cat.id?ui.visualCategorySelected:""}`} onClick={()=>setSelected(cat.id)}>
        <ArtBox item={cat} isCategory/>
        <div><strong>{cat.public_name||cat.name}</strong><span>{products.filter(p=>p.category_id===cat.id).length} productos</span></div>
      </button>)}</div>:<div className={ui.visualCategoryList}>{categories.map(cat=><button key={cat.id} className={`${ui.visualCategoryRow} ${selected===cat.id?ui.visualCategorySelected:""}`} onClick={()=>setSelected(cat.id)}><ArtBox item={cat} isCategory/><strong>{cat.public_name||cat.name}</strong><span>{products.filter(p=>p.category_id===cat.id).length}</span></button>)}</div>}

      <div className={ui.visualSectionHead}><div><span>PRODUCTOS</span><h2>{selectedCategory?.public_name||selectedCategory?.name||"Todos"}</h2></div><small>{visibleProducts.length} disponibles</small></div>

      {productMode==="buttons"?<div className={ui.visualProductGrid}>{visibleProducts.map(product=><button key={product.id} className={ui.visualProductCard} onClick={()=>clickLegacy(rootRef,product.public_name||product.name)}>
        <ArtBox item={product} category={selectedCategory}/>
        <div className={ui.visualProductInfo}><strong>{product.public_name||product.name}</strong><span>{money(product.restaurant_price??product.price)}</span></div>
        {product.track_stock&&<small className={ui.stockPill}>Stock {Number(product.stock_quantity||0)}</small>}
      </button>)}</div>:<div className={ui.visualProductList}>{visibleProducts.map(product=><button key={product.id} className={ui.visualProductRow} onClick={()=>clickLegacy(rootRef,product.public_name||product.name)}><ArtBox item={product} category={selectedCategory}/><div><strong>{product.public_name||product.name}</strong><span>{product.sku||"Sin código"}</span></div><b>{money(product.restaurant_price??product.price)}</b></button>)}</div>}

      {!visibleProducts.length&&<div className={ui.visualEmpty}>No hay productos en esta categoría.</div>}
    </>}
  </section>;
}
