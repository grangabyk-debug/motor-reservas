"use client";

const common={viewBox:"0 0 64 64",fill:"none",stroke:"currentColor",strokeWidth:"2.6",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true};

export default function ComandaArt({kind="dish",className=""}){
  const p={...common,className};
  switch(kind){
    case "coffee": return <svg {...p}><path d="M17 25h27v12a12 12 0 0 1-12 12h-3a12 12 0 0 1-12-12V25Z"/><path d="M44 29h4a7 7 0 0 1 0 14h-5"/><path d="M24 18c-4-4 4-6 0-10M32 18c-4-4 4-6 0-10M40 18c-4-4 4-6 0-10"/><path d="M14 53h37"/></svg>;
    case "starter": return <svg {...p}><path d="M10 41h44"/><path d="M14 41c2-13 9-21 18-21s16 8 18 21"/><path d="M32 16v-4"/><circle cx="32" cy="10" r="2"/><path d="M22 32c5-4 15-4 20 0"/></svg>;
    case "main": return <svg {...p}><circle cx="32" cy="34" r="20"/><circle cx="32" cy="34" r="13"/><path d="M24 34c4-7 12-7 16 0-4 7-12 7-16 0Z"/><path d="M48 13v14M53 13v14M48 20h5"/></svg>;
    case "side": return <svg {...p}><path d="M13 29h38l-5 20H18l-5-20Z"/><path d="M20 25c2-8 8-11 12-4 3-8 10-6 12 2"/><path d="M22 36h20M20 42h24"/></svg>;
    case "pasta": return <svg {...p}><path d="M12 36h40c-1 12-9 18-20 18S13 48 12 36Z"/><path d="M17 32c5-7 10-8 15-3 5-6 10-5 15 1"/><path d="M24 30c-2-8 7-9 5-16M33 29c-1-7 7-8 5-15M41 30c-2-6 5-7 4-13"/></svg>;
    case "salad": return <svg {...p}><path d="M12 33h40c-2 13-9 20-20 20S14 46 12 33Z"/><path d="M18 31c1-9 10-12 15-5 3-8 13-8 15 4"/><path d="M26 27c-3-5-1-10 4-13M35 25c1-6 5-9 10-10"/></svg>;
    case "burger": return <svg {...p}><path d="M13 29c1-10 8-16 19-16s18 6 19 16H13Z"/><path d="M11 34h42M13 40h38M15 46h34c0 4-3 7-7 7H22c-4 0-7-3-7-7Z"/><path d="M19 36l6 4 7-4 7 4 6-4"/></svg>;
    case "sandwich": return <svg {...p}><path d="M13 22c8-9 30-9 38 0l-3 8H16l-3-8Z"/><path d="M16 30l5 7 7-5 8 6 7-6 5 6-3 10H19l-3-10"/><path d="M19 48h26"/></svg>;
    case "dessert": return <svg {...p}><path d="M17 29h30l-4 22H21l-4-22Z"/><path d="M22 29c1-9 7-14 10-14s9 5 10 14"/><path d="M32 15c-1-5 2-8 6-9"/><circle cx="39" cy="7" r="2"/></svg>;
    case "drink": return <svg {...p}><path d="M21 13h24l-4 40H25l-4-40Z"/><path d="M24 24h18"/><path d="M37 13l6-8"/><path d="M27 32c4-3 8 3 12 0"/></svg>;
    case "wine": return <svg {...p}><path d="M19 10h18v13c0 7-4 12-9 12s-9-5-9-12V10Z"/><path d="M28 35v15M20 53h16"/><path d="M40 18h8v31M40 49h13"/><path d="M43 12h5v6h-5z"/></svg>;
    case "celiac": return <svg {...p}><circle cx="32" cy="32" r="23"/><path d="M32 16v33M25 20c9 4 9 9 0 13M39 22c-9 4-9 9 0 13M25 36c9 4 9 9 0 13M39 36c-9 4-9 9 0 13"/><path d="M16 48 48 16"/></svg>;
    case "ice": return <svg {...p}><path d="M13 18h38L45 52H19l-6-34Z"/><path d="M20 18l6-9h12l6 9"/><path d="m24 30 8-5 8 5-3 9H27l-3-9Z"/></svg>;
    case "extras": return <svg {...p}><path d="M14 20h36v32H14z"/><path d="M14 29h36M26 20v32M38 20v32"/><path d="M19 13h26v7H19z"/></svg>;
    case "roomservice": return <svg {...p}><path d="M9 42h46"/><path d="M13 42c2-14 9-22 19-22s17 8 19 22"/><path d="M32 16v-4"/><circle cx="32" cy="10" r="2"/><path d="M20 49h24"/></svg>;
    case "computer": return <svg {...p}><rect x="9" y="11" width="46" height="31" rx="4"/><path d="M25 52h14M32 42v10"/><path d="M18 21h28M18 28h18M18 35h11"/></svg>;
    case "waiter": return <svg {...p}><circle cx="28" cy="15" r="7"/><path d="M16 52v-9c0-12 5-18 12-18s12 6 12 18v9"/><path d="M40 32h12v15H40"/><path d="M43 32c0-5 2-8 6-8s6 3 6 8"/></svg>;
    case "kitchen": return <svg {...p}><path d="M15 26c0-7 5-12 11-12 3-7 15-7 18 0 6 0 11 5 11 12 0 5-3 9-8 11H23c-5-2-8-6-8-11Z"/><path d="M22 37v15h26V37M29 43v9M41 43v9"/></svg>;
    case "printer": return <svg {...p}><rect x="17" y="8" width="30" height="16" rx="2"/><rect x="10" y="23" width="44" height="24" rx="5"/><path d="M18 40h28v16H18z"/><circle cx="46" cy="31" r="2"/></svg>;
    case "bar": return <svg {...p}><path d="M11 13h42L37 33v18h9M18 51h38M27 33 11 13"/><path d="M20 19h24"/><circle cx="41" cy="19" r="3"/></svg>;
    case "support": return <svg {...p}><circle cx="32" cy="21" r="9"/><path d="M16 51v-7c0-9 7-15 16-15s16 6 16 15v7"/><path d="M12 24v-4c0-11 9-18 20-18s20 7 20 18v4"/><path d="M12 24h5v11h-5zM47 24h5v11h-5z"/><path d="M47 35c0 7-4 10-10 10"/></svg>;
    case "branch": return <svg {...p}><path d="M11 28 32 10l21 18"/><path d="M16 25v29h32V25"/><path d="M24 54V36h16v18"/><path d="M21 29h4M30 29h4M39 29h4"/></svg>;
    case "cash": return <svg {...p}><rect x="10" y="16" width="44" height="33" rx="5"/><path d="M10 27h44M18 38h9"/><circle cx="43" cy="38" r="6"/><path d="M43 34v8M40 36h5M40 40h5"/></svg>;
    case "user": return <svg {...p}><circle cx="32" cy="20" r="10"/><path d="M13 54c2-14 9-22 19-22s17 8 19 22"/></svg>;
    default: return <svg {...p}><circle cx="32" cy="33" r="20"/><path d="M18 34h28M22 25h20M24 43h16"/></svg>;
  }
}

export const CATEGORY_ART={
  "Cafetería":"coffee","Entradas":"starter","Principales":"main","Guarniciones":"side","Pastas":"pasta","Ensaladas":"salad","Hamburguesas":"burger","Sándwiches":"sandwich","Sandwiches":"sandwich","Postres":"dessert","Bebidas sin alcohol":"drink","Bebidas con alcohol":"drink","Vinos":"wine","Celíaco":"celiac","Celiaco":"celiac","Hielo":"ice","Extras":"extras","Room Service":"roomservice"
};
