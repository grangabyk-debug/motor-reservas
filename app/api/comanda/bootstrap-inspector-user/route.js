import { NextResponse } from "next/server";

const TOKEN = "T3mpBootstrap_Xl2xWhrSm3QVavLJbGW9DyalBWfXoWa0ublwHGX39sI";
const EDGE_URL = "https://kklvahycvojoktacpyiu.supabase.co/functions/v1/comanda-inspector-bootstrap?token=Xl2xWhrSm3QVavLJbGW9DyalBWfXoWa0ublwHGX39sI";

export async function GET(request){
  const { searchParams } = new URL(request.url);
  if(searchParams.get("token")!==TOKEN)return NextResponse.json({ok:false},{status:404});
  const response=await fetch(EDGE_URL,{method:"GET",cache:"no-store"});
  const text=await response.text();
  let data;try{data=JSON.parse(text)}catch{data={raw:text}}
  return NextResponse.json(data,{status:response.status});
}
