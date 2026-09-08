import PmsNextApp from"./PmsNextApp"

export const metadata={
  title:"Habitación Llena · PMS Hotelero",
  description:"Gestión hotelera integral de Habitación Llena.",
  robots:{index:false,follow:false},
}

export default function PmsNextPage(){
  const buildId=process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||"local"
  return <><PmsNextApp buildId={buildId}/><style>{`
    @media(min-width:761px){
      [aria-label="Rooming por habitación"] article>div:nth-child(2){
        display:grid!important;
        grid-template-columns:repeat(5,minmax(0,1fr))!important;
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
    }
  `}</style></>
}
