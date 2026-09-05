import BookingEngine from"./BookingEngine"

export default async function BookingEnginePage({params,searchParams}){const{slug}=await params,query=await searchParams;return <BookingEngine slug={slug} embedded={query?.embed==="1"}/>}
