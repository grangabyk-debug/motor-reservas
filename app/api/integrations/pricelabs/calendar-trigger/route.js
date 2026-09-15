import{handlePriceLabsCallback}from"../_callback"
export const runtime="nodejs"
export async function POST(request){return handlePriceLabsCallback(request,"calendar_trigger")}
