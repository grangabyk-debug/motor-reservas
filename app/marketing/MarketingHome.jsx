import LandingExperience from "./LandingExperience"

export default function MarketingHome(){
  const schema={
    "@context":"https://schema.org",
    "@type":"SoftwareApplication",
    name:"Habitación Llena",
    applicationCategory:"BusinessApplication",
    operatingSystem:"Web",
    description:"Hospitality Operating System y PMS hotelero para operación, reservas, huéspedes, revenue, housekeeping y venta directa."
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
    <LandingExperience/>
  </>
}
