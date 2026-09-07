import BookingEngine from"./BookingEngine"

export default async function BookingEnginePage({params,searchParams}){const{slug}=await params,query=await searchParams,initialSearch={checkIn:query?.check_in||query?.checkIn||null,checkOut:query?.check_out||query?.checkOut||null,guests:query?.guests||null};return <BookingEngine slug={slug} embedded={query?.embed==="1"} initialSearch={initialSearch}/>}
