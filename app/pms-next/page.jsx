import PmsNextApp from"./PmsNextApp"

export const metadata={
  title:"Habitación Llena · PMS Hotelero",
  description:"Gestión hotelera integral de Habitación Llena.",
  robots:{index:false,follow:false},
}

export default function PmsNextPage(){
  const buildId=process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||"local"
  return <PmsNextApp buildId={buildId}/>
}
