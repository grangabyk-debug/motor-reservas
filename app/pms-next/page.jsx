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
