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
      [aria-label="Crear reserva"] [aria-label="Rooming por habitación"] article>div:nth-child(2){
        grid-template-columns:minmax(130px,1.2fr) minmax(78px,.62fr) minmax(96px,.75fr) minmax(112px,.88fr) minmax(104px,.82fr)!important;
        gap:8px!important;
        align-items:end!important;
      }
      [aria-label="Crear reserva"] [aria-label="Rooming por habitación"] article>div:nth-child(2)>label{
        display:grid;
        grid-template-rows:14px 36px;
        gap:5px;
        min-width:0;
        align-items:stretch;
      }
      [aria-label="Crear reserva"] [aria-label="Rooming por habitación"] article>div:nth-child(2)>label>span:first-child{
        height:14px!important;
        margin-bottom:0!important;
        line-height:14px;
        overflow:visible!important;
        text-overflow:clip!important;
      }
    }
  `}</style></>
}
