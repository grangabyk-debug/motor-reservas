"use client";

const common={viewBox:"0 0 64 64",fill:"none",stroke:"currentColor",strokeWidth:"2.6",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true};

export default function ComandaArt({kind="dish",className=""}){
  const p={...common,className};
  switch(kind){
    case "coffee": return <svg {...p}><path d="M17 25h27v12a12 12 0 0 1-12 12h-3a12 12 0 0 1-12-12V25Z"/><path d="M44 29h4a7 7 0 0 1 0 14h-5"/><path d="M24 18c-4-4 4-6 0-10M32 18c-4-4 4-6 0-10M40 18c-4-4 4-6 0-10"/><path d="M14 53h37"/></svg>;
    case "croissant": return <svg {...p}><path d="M13 37c3-11 10-19 19-20 9 1 16 9 19 20-5-4-9-5-13-3-2-7-10-7-12 0-4-2-8-1-13 3Z"/><path d="M22 31c3-5 6-7 10-7s7 2 10 7M18 42c9 5 19 5 28 0"/></svg>;
    case "empanada": return <svg {...p}><path d="M12 39c8-18 28-25 40-8-9 17-27 23-40 8Z"/><path d="M18 38c8-4 20-9 30-8M22 34l3 5m4-8 3 5m4-8 3 5m4-7 2 4"/></svg>;
    case "starter": return <svg {...p}><path d="M10 41h44"/><path d="M14 41c2-13 9-21 18-21s16 8 18 21"/><path d="M32 16v-4"/><circle cx="32" cy="10" r="2"/><path d="M22 32c5-4 15-4 20 0"/></svg>;
    case "main": return <svg {...p}><circle cx="32" cy="34" r="20"/><circle cx="32" cy="34" r="13"/><path d="M22 34c3-6 11-8 17-3 2 2 3 4 3 6-5 5-15 5-20-3Z"/><path d="M43 26c3 2 5 5 6 8M17 41c4-1 7 0 10 3"/></svg>;
    case "steak": return <svg {...p}><path d="M14 34c2-13 13-22 27-19 10 2 14 11 8 20-7 11-29 16-35 7-2-2-2-5 0-8Z"/><path d="M25 27c7-5 14-5 19 0M23 34c7-4 14-4 20 0M22 41c6-3 12-3 17 0"/></svg>;
    case "side": return <svg {...p}><path d="M13 29h38l-5 20H18l-5-20Z"/><path d="M20 25c2-8 8-11 12-4 3-8 10-6 12 2"/><path d="M22 36h20M20 42h24"/></svg>;
    case "fries": return <svg {...p}><path d="M19 26 16 51h32l-3-25H19Z"/><path d="M22 26 19 10M28 26l-1-18M34 26V9M40 26l3-17M45 26l5-14"/></svg>;
    case "pasta": return <svg {...p}><path d="M12 36h40c-1 12-9 18-20 18S13 48 12 36Z"/><path d="M17 32c5-7 10-8 15-3 5-6 10-5 15 1"/><path d="M24 30c-2-8 7-9 5-16M33 29c-1-7 7-8 5-15M41 30c-2-6 5-7 4-13"/></svg>;
    case "salad": return <svg {...p}><path d="M12 33h40c-2 13-9 20-20 20S14 46 12 33Z"/><path d="M18 31c1-9 10-12 15-5 3-8 13-8 15 4"/><path d="M26 27c-3-5-1-10 4-13M35 25c1-6 5-9 10-10"/></svg>;
    case "burger": return <svg {...p}><path d="M13 29c1-10 8-16 19-16s18 6 19 16H13Z"/><path d="M11 34h42M13 40h38M15 46h34c0 4-3 7-7 7H22c-4 0-7-3-7-7Z"/><path d="M19 36l6 4 7-4 7 4 6-4"/></svg>;
    case "sandwich": return <svg {...p}><path d="M13 22c8-9 30-9 38 0l-3 8H16l-3-8Z"/><path d="M16 30l5 7 7-5 8 6 7-6 5 6-3 10H19l-3-10"/><path d="M19 48h26"/></svg>;
    case "pizza": return <svg {...p}><path d="M12 49 29 13c11 5 18 15 23 28L12 49Z"/><circle cx="31" cy="30" r="3"/><circle cx="40" cy="38" r="3"/><circle cx="25" cy="41" r="3"/><path d="M29 13c8 2 16 9 21 17"/></svg>;
    case "dessert": return <svg {...p}><path d="M17 29h30l-4 22H21l-4-22Z"/><path d="M22 29c1-9 7-14 10-14s9 5 10 14"/><path d="M32 15c-1-5 2-8 6-9"/><circle cx="39" cy="7" r="2"/></svg>;
    case "icecream": return <svg {...p}><path d="M23 31h18L32 54 23 31Z"/><circle cx="26" cy="25" r="8"/><circle cx="38" cy="25" r="8"/><circle cx="32" cy="17" r="8"/></svg>;
    case "cake": return <svg {...p}><path d="M14 28h36v23H14z"/><path d="M14 37h36M19 28c0-7 5-11 13-11s13 4 13 11"/><path d="M32 17v-7"/><circle cx="32" cy="8" r="2"/></svg>;
    case "drink": return <svg {...p}><path d="M21 13h24l-4 40H25l-4-40Z"/><path d="M24 24h18"/><path d="M37 13l6-8"/><path d="M27 32c4-3 8 3 12 0"/></svg>;
    case "water": return <svg {...p}><path d="M25 12h14l2 9v31H23V21l2-9Z"/><path d="M28 7h8v5h-8zM23 29h18"/><path d="M27 40c3-4 7-4 10 0"/></svg>;
    case "soda": return <svg {...p}><path d="M22 9h20l3 45H19L22 9Z"/><path d="M23 18h20M24 39h19"/><circle cx="29" cy="29" r="2"/><circle cx="36" cy="25" r="2"/></svg>;
    case "beer": return <svg {...p}><path d="M16 18h27v33H16z"/><path d="M43 25h6a7 7 0 0 1 0 14h-6"/><path d="M20 23c3-6 7-6 10-1 3-5 8-5 11 1M22 31v13M29 31v13M36 31v13"/></svg>;
    case "cocktail": return <svg {...p}><path d="M12 13h40L34 34v17M25 54h18"/><path d="M19 20h26"/><circle cx="43" cy="18" r="5"/></svg>;
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
  "cafetería":"coffee","cafeteria":"coffee","entradas":"empanada","principales":"main","guarniciones":"side","pastas":"pasta","ensaladas":"salad","hamburguesas":"burger","sándwiches":"sandwich","sandwiches":"sandwich","postres":"dessert","bebidas":"drink","bebidas sin alcohol":"soda","bebidas con alcohol":"cocktail","vinos":"wine","celíaco":"celiac","celiaco":"celiac","hielo":"ice","extras":"extras","room service":"roomservice"
};

export function resolveCategoryArt(category={}){
  if(category.image_key)return category.image_key;
  const name=String(category.public_name||category.name||"").toLowerCase().trim();
  return CATEGORY_ART[name]||Object.entries(CATEGORY_ART).find(([key])=>name.includes(key))?.[1]||"dish";
}

export function resolveProductArt(product={},category={}){
  if(product.image_key)return product.image_key;
  const text=`${product.public_name||product.name||""} ${category?.name||""}`.toLowerCase();
  const rules=[
    [/medialuna|croissant/,"croissant"],[/empanad|provoleta|bruschetta/,"empanada"],[/espresso|expreso|americano|cortado|capuccino|cappuccino|latte|café|cafe/,"coffee"],
    [/milanesa|bife|lomo|entraña|asado|carne|ojo de bife|chorizo/,"steak"],[/papa frit|fritas/,"fries"],[/pasta|raviol|sorrent|ñoqui|spaghetti|fideo|tallar/,"pasta"],
    [/ensalad/,"salad"],[/hamburg/,"burger"],[/sandwich|sándwich|lomito|tostado/,"sandwich"],[/pizza|fugazz|muzza/,"pizza"],
    [/helado/,"icecream"],[/torta|cheesecake|brownie|flan|tiramis|postre/,"cake"],[/agua mineral|agua sin|agua con/,"water"],[/coca|pepsi|sprite|fanta|gaseosa|soda|agua saborizada/,"soda"],
    [/cerveza|birra/,"beer"],[/vino|malbec|cabernet|chardonnay|sauvignon/,"wine"],[/gin|fernet|aperol|campari|cocktail|trago|whisky|vodka|ron/,"cocktail"],
    [/hielo/,"ice"],[/celiac|celíac/,"celiac"],[/room service/,"roomservice"],[/mayonesa|ketchup|mostaza|queso rallado|servilleta|pan$/, "extras"]
  ];
  for(const [re,kind] of rules)if(re.test(text))return kind;
  return resolveCategoryArt(category);
}
