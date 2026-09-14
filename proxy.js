import{NextResponse}from"next/server"

const ALLOWED_PATHS=new Set(["/","/login","/reset-password","/pms-next","/manifest.webmanifest","/sw.js","/favicon.ico"])

function isHabitacionLlenaHost(hostname){
  const host=String(hostname||"").split(":")[0].toLowerCase()
  return host==="habitacionllena.com"||host==="www.habitacionllena.com"||(host.endsWith(".vercel.app")&&(host.startsWith("motor-reservas-")||host.startsWith("motor-reservas-app")))
}

export function proxy(request){
  const host=request.headers.get("x-forwarded-host")||request.headers.get("host")||request.nextUrl.hostname
  if(!isHabitacionLlenaHost(host))return NextResponse.next()

  const pathname=request.nextUrl.pathname
  if(pathname.startsWith("/api/")||pathname.startsWith("/_next/")||pathname.startsWith("/icons/")||pathname.startsWith("/images/")||pathname.startsWith("/fonts/")||ALLOWED_PATHS.has(pathname))return NextResponse.next()

  const url=request.nextUrl.clone()
  url.pathname="/"
  url.search=""
  return NextResponse.redirect(url)
}

export const config={matcher:["/((?!_next/static|_next/image).*)"]}
