export const dynamic="force-dynamic"
export const revalidate=0

export async function GET(){
  const buildId=process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||"local"
  return Response.json({buildId},{headers:{"Cache-Control":"no-store, max-age=0"}})
}
