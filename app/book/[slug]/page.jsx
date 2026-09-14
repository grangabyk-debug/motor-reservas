import BookingEngineTracked from"./BookingEngineTracked"

export default async function BookingEnginePage({params,searchParams}){const{slug}=await params,query=await searchParams,initialSearch={checkIn:query?.check_in||query?.checkIn||null,checkOut:query?.check_out||query?.checkOut||null,guests:query?.guests||null},embedded=query?.embed==="1",source=String(query?.source|| (embedded?"embed":"direct")).slice(0,40);return <BookingEngineTracked slug={slug} embedded={embedded} initialSearch={initialSearch} source={source}/>}
