import PmsNextApp from"./PmsNextApp"

export const metadata={
  title:"Habitación Llena · PMS Hotelero",
  description:"Gestión hotelera integral de Habitación Llena.",
  robots:{index:false,follow:false},
}

export default function PmsNextPage(){
  const buildId=process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||"local"
  return <><PmsNextApp buildId={buildId}/><style>{`
    [data-workspace="planning"] > section > div:has([aria-label="Herramientas del Planning"]){
      position:relative!important;
      top:auto!important;
    }
    [class*="welcomeMark"],
    [class*="oliviaMark"]{
      background-color:transparent!important;
      background-image:url('/olivia-avatar.svg')!important;
      background-position:center!important;
      background-repeat:no-repeat!important;
      background-size:contain!important;
      color:transparent!important;
      font-size:0!important;
    }
    [class*="oliviaMark"]{
      overflow:visible!important;
      box-shadow:0 10px 24px rgba(78,62,145,.16)!important;
      animation:hlOliviaPresence 3.8s ease-in-out infinite;
    }
    div[role="status"][class*="nudge"]{
      animation:oliviaNudgeLifetime 5s cubic-bezier(.2,.8,.2,1) both!important;
      transform-origin:100% 100%;
    }
    div[role="status"][class*="nudge"]:hover{
      animation-play-state:paused!important;
    }
    [data-workspace="dashboard"] [data-fresh="true"]{
      position:relative;
      animation:hlSignalArrive .7s cubic-bezier(.2,.8,.2,1) both;
    }
    [data-workspace="dashboard"] [data-fresh="true"][data-tone="red"]{
      box-shadow:inset 3px 0 rgba(232,91,98,.76),0 0 24px rgba(232,91,98,.08);
    }
    [data-workspace="dashboard"] [data-fresh="true"][data-tone="yellow"]{
      box-shadow:inset 3px 0 rgba(224,166,53,.72),0 0 22px rgba(224,166,53,.07);
    }
    [data-operation-resolved="true"]{
      display:grid;
      grid-template-columns:28px minmax(0,1fr);
      align-items:center;
      gap:8px;
      margin:4px 2px 7px;
      padding:8px 9px;
      border:1px solid color-mix(in srgb,#20a875 18%,var(--line));
      border-radius:12px;
      background:color-mix(in srgb,#20a875 6%,var(--panelSolid));
      animation:hlResolvedIn 2.1s cubic-bezier(.2,.8,.2,1) both;
    }
    [data-operation-resolved="true"]>span{
      display:grid;
      width:26px;
      height:26px;
      place-items:center;
      border-radius:9px;
      background:color-mix(in srgb,#20a875 12%,var(--panelSolid));
      color:#16875f;
      font-weight:950;
      box-shadow:0 0 16px rgba(32,168,117,.13);
    }
    [data-operation-resolved="true"]>div{display:grid;gap:1px;min-width:0}
    [data-operation-resolved="true"] b{font-size:11.5px;color:#16875f}
    [data-operation-resolved="true"] small{font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    [data-live-state="loading"] [class*="operationStatus"] i{
      animation:hlThinkingLight 1.05s ease-in-out infinite!important;
    }
    [class*="operationStatus"] i[data-tone="green"],
    [class*="operationFoot"] i[data-tone="green"]{
      animation:hlHealthyBreath 3.2s ease-in-out infinite;
    }
    [data-workspace="planning"] [draggable="true"]{
      transition:transform .16s cubic-bezier(.2,.8,.2,1),filter .16s ease,box-shadow .16s ease!important;
      transform-origin:center;
    }
    [data-workspace="planning"] [draggable="true"]:active{
      transform:scale(.985)!important;
      filter:saturate(1.06) brightness(1.01);
    }
    @keyframes oliviaNudgeLifetime{
      0%{opacity:0;transform:translateX(8px) scale(.985);visibility:visible}
      8%,82%{opacity:1;transform:none;visibility:visible}
      100%{opacity:0;transform:translateX(8px) scale(.985);visibility:hidden;pointer-events:none}
    }
    @keyframes hlOliviaPresence{
      0%,100%{transform:translateY(0);filter:drop-shadow(0 8px 12px rgba(85,64,165,.08))}
      50%{transform:translateY(-1px);filter:drop-shadow(0 10px 16px rgba(85,64,165,.16))}
    }
    @keyframes hlSignalArrive{
      0%{opacity:.25;transform:translateY(6px) scale(.992);filter:saturate(.8)}
      62%{opacity:1;transform:translateY(-1px) scale(1.002);filter:saturate(1.08)}
      100%{opacity:1;transform:none;filter:none}
    }
    @keyframes hlResolvedIn{
      0%{opacity:0;transform:translateY(5px) scale(.985)}
      18%,72%{opacity:1;transform:none}
      100%{opacity:0;transform:translateY(-3px) scale(.99)}
    }
    @keyframes hlThinkingLight{
      0%,100%{opacity:.4;transform:scale(.82);box-shadow:0 0 0 4px color-mix(in srgb,#e5a52f 8%,transparent)}
      50%{opacity:1;transform:scale(1);box-shadow:0 0 0 7px color-mix(in srgb,#e5a52f 12%,transparent),0 0 17px color-mix(in srgb,#e5a52f 35%,transparent)}
    }
    @keyframes hlHealthyBreath{
      0%,100%{opacity:.72;box-shadow:0 0 8px rgba(32,168,117,.22)}
      50%{opacity:1;box-shadow:0 0 15px rgba(32,168,117,.42)}
    }
    @media(prefers-reduced-motion:reduce){
      div[role="status"][class*="nudge"]{
        animation:oliviaNudgeLifetimeReduced 5s linear both!important;
      }
      [class*="oliviaMark"],
      [data-workspace="dashboard"] [data-fresh="true"],
      [data-operation-resolved="true"],
      [data-live-state="loading"] [class*="operationStatus"] i,
      [class*="operationFoot"] i,
      [data-workspace="planning"] [draggable="true"]{
        animation:none!important;
        transition:none!important;
      }
      @keyframes oliviaNudgeLifetimeReduced{
        0%,90%{opacity:1;visibility:visible}
        100%{opacity:0;visibility:hidden;pointer-events:none}
      }
    }
    @media(min-width:761px){
      [aria-label="Rooming por habitación"] article>div:nth-child(2){
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr)) minmax(96px,1fr)!important;
        gap:8px!important;
        align-items:start!important;
      }
      [aria-label="Rooming por habitación"] article>div:nth-child(2)>label{
        display:grid!important;
        grid-template-rows:14px 40px!important;
        gap:5px!important;
        min-width:0!important;
        margin:0!important;
        align-items:stretch!important;
      }
      [aria-label="Rooming por habitación"] article>div:nth-child(2)>label>span:first-child{
        display:block!important;
        width:100%!important;
        height:14px!important;
        margin:0!important;
        line-height:14px!important;
        font-size:9px!important;
        letter-spacing:0!important;
        white-space:nowrap!important;
        overflow:visible!important;
        text-overflow:clip!important;
      }
      [aria-label="Rooming por habitación"] article>div:nth-child(2)>label>select,
      [aria-label="Rooming por habitación"] article>div:nth-child(2)>label>input,
      [aria-label="Rooming por habitación"] article>div:nth-child(2)>label>span:not(:first-child){
        width:100%!important;
        height:40px!important;
        min-height:40px!important;
        max-height:40px!important;
        box-sizing:border-box!important;
        margin:0!important;
      }
      [aria-label="Rooming por habitación"] article>div:nth-child(2)>label>span:not(:first-child)>select{
        width:100%!important;
        height:100%!important;
        min-width:0!important;
      }
      [aria-label="Rooming por habitación"] article>div:nth-child(2)>label:nth-child(5)>input{
        min-width:0!important;
        padding-left:8px!important;
        padding-right:8px!important;
        font-size:12px!important;
        letter-spacing:-.01em!important;
      }
    }
  `}</style></>
}
