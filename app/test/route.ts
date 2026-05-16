export async function GET() {
  return Response.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key_start: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20),
  })
}
