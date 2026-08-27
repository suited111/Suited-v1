const SuitedAITryOn={
  async generate(product){
    const photo=SuitedFitRoom.getPhoto();
    if(!photo) throw new Error('Add your fitting-room photo first.');
    const profile=get('profile',{});
    const payload={
      personImage:photo,
      garment:{id:product.id,name:product.name,retailer:product.retailer,url:product.url,image:product.image||imageForProduct(product),category:product.category||'clothing'},
      profile:{size:profile.size||null,height:profile.height||null,bust:profile.bust||null,waist:profile.waist||null,hips:profile.hips||null,fit:profile.fit||null},
      consent:true
    };
    if(SuitedAccount?.mode==='cloud'&&SuitedAccount?.cloud){
      const {data,error}=await SuitedAccount.cloud.functions.invoke('virtual-tryon',{body:payload});
      if(error)throw error;
      if(!data?.imageUrl)throw new Error(data?.message||'No try-on image was returned.');
      return data.imageUrl;
    }
    throw new Error('AI try-on backend is built but not activated yet. Connect the cloud backend/provider to generate real images.');
  }
};

async function generateAITryOn(productId){
  const product=(window.catalogProducts||[]).find(p=>p.id===productId) || (typeof products!=='undefined'?products.find(p=>p.id===productId):null);
  if(!product)return toast('Product not found');
  const consent=document.getElementById('aiTryConsent');
  if(consent&&!consent.checked){toast('Please confirm photo-processing consent first');return}
  const area=document.getElementById('aiTryOnResult');
  const button=document.getElementById('aiTryButton');
  if(button){button.disabled=true;button.textContent='Generating…'}
  if(area)area.innerHTML='<div class="ai-generating"><strong>Creating your AI try-on…</strong><span>This can take a little while once the provider is connected.</span></div>';
  try{
    const imageUrl=await SuitedAITryOn.generate(product);
    if(area)area.innerHTML=`<div class="generated-tryon"><img src="${imageUrl}" alt="AI-generated virtual try-on"><div><span class="eyebrow">AI-GENERATED PREVIEW</span><h3>${escapeHtml(product.name)} on your fitting-room image</h3><p>AI previews are visual guidance, not a guarantee of exact fit, drape, colour or proportions.</p></div></div>`;
  }catch(err){
    if(area)area.innerHTML=`<div class="ai-unavailable"><strong>AI generation is not active yet.</strong><p>${escapeHtml(err.message)}</p><p>The complete request pipeline is now built. The remaining activation is a cloud project plus a virtual-try-on provider/API credential.</p></div>`;
  }finally{if(button){button.disabled=false;button.textContent='Generate AI try-on'}}
}
