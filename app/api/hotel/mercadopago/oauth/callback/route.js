import{NextResponse}from"next/server"

export async function GET(request){
  const url=new URL(request.url),target=new URL("/pms-next",url.origin),code=url.searchParams.get("code"),state=url.searchParams.get("state"),error=url.searchParams.get("error")||url.searchParams.get("error_description")
  target.searchParams.set("view","finance")
  target.searchParams.set("finance_tab","online")
  if(error)target.searchParams.set("mp_error",error)
  else if(code&&state){target.searchParams.set("mp_code",code);target.searchParams.set("mp_state",state)}
  else target.searchParams.set("mp_error","Mercado Pago no devolvió una autorización válida.")
  return NextResponse.redirect(target)
}
