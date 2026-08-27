import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const body=await req.json()
    if(!body?.consent)return json({message:'Explicit photo-processing consent is required.'},400)
    if(!body?.personImage||!body?.garment?.image)return json({message:'Person and garment images are required.'},400)

    // Provider-neutral adapter. Keep all private credentials in Supabase secrets,
    // never in the public GitHub Pages JavaScript.
    const endpoint=Deno.env.get('TRYON_API_URL')
    const key=Deno.env.get('TRYON_API_KEY')
    if(!endpoint||!key)return json({message:'Virtual try-on provider is not configured yet.'},503)

    const providerResponse=await fetch(endpoint,{
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        person_image:body.personImage,
        garment_image:body.garment.image,
        garment_name:body.garment.name,
        category:body.garment.category||'clothing',
        measurements:body.profile||{}
      })
    })
    const result=await providerResponse.json()
    if(!providerResponse.ok)throw new Error(result?.message||'Try-on provider request failed')
    const imageUrl=result.image_url||result.output?.image_url||result.output_url||result.url
    if(!imageUrl)return json({message:'Provider returned no generated image.'},502)
    return json({imageUrl})
  }catch(error){return json({message:error instanceof Error?error.message:'Virtual try-on failed.'},500)}
})

function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}})}
