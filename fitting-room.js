const SuitedFitRoom={
  currentProduct:null,
  getPhoto(){return localStorage.getItem('suitedFitPhoto')||''},
  savePhoto(dataUrl){localStorage.setItem('suitedFitPhoto',dataUrl)},
  clearPhoto(){localStorage.removeItem('suitedFitPhoto')},
  fitAssessment(product){
    const p=get('profile',{});
    const size=String(p.size||'');
    const sizes=Array.isArray(product?.sizes)?product.sizes.map(String):[];
    const available=!size||!sizes.length||sizes.includes(size);
    const notes=[];
    if(size)notes.push(available?`Size ${size} appears in this product's catalogue sizes.`:`Size ${size} is not listed in the current catalogue snapshot.`);
    if(p.fit)notes.push(`Your preferred fit is ${String(p.fit).toLowerCase()}.`);
    if(p.avoid)notes.push(`Your fit note: ${p.avoid}`);
    return {available,notes};
  }
};

function fittingRoomSetup(){
  const photo=SuitedFitRoom.getPhoto();
  const p=get('profile',{});
  app.innerHTML=`<section class="fitroom-layout"><div class="panel"><span class="eyebrow">SUITED VIRTUAL FITTING ROOM</span><h1>Create your try-on profile.</h1><p class="subtext">Upload a clear full-length photo and Suited will use it as your fitting-room reference on this device. V1 does not yet generate a photorealistic garment-on-body image — that requires the AI image backend we will connect next.</p><div class="photo-uploader">${photo?`<img src="${photo}" alt="Your fitting room photo" class="fit-user-photo">`:`<div class="photo-placeholder"><strong>Add a full-length photo</strong><span>Front-facing, good lighting, simple background works best.</span></div>`}<label class="primary upload-button">${photo?'Change photo':'Choose photo'}<input id="fitPhotoInput" type="file" accept="image/*" hidden></label>${photo?'<button class="secondary" onclick="SuitedFitRoom.clearPhoto();fittingRoomSetup()">Remove photo</button>':''}</div><div class="fit-profile-summary"><h3>Your body profile</h3><div class="summary-list"><div class="summary-item"><span>NZ size</span><strong>${p.size||'Not set'}</strong></div><div class="summary-item"><span>Height</span><strong>${p.height?`${p.height} cm`:'Not set'}</strong></div><div class="summary-item"><span>Bust / waist / hips</span><strong>${[p.bust,p.waist,p.hips].filter(Boolean).join(' / ')||'Optional'}</strong></div><div class="summary-item"><span>Preferred fit</span><strong>${p.fit||'Not set'}</strong></div></div><div class="actions"><button class="secondary" onclick="profile()">Edit measurements</button><button class="primary" onclick="ask()">Find clothes to try</button></div></div></div><aside class="summary-card"><span class="eyebrow">HOW V1 WORKS</span><h3>Fit confidence first.</h3><p>Suited checks your saved size, measurements and preferences against each catalogue item, then shows your photo beside the selected garment as a fitting-room preview. The true AI-rendered try-on will plug into this same screen.</p></aside></section>`;
  const input=document.getElementById('fitPhotoInput');
  if(input)input.onchange=e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>4*1024*1024){toast('Please choose a photo under 4 MB');return}
    const reader=new FileReader();reader.onload=()=>{SuitedFitRoom.savePhoto(reader.result);toast('Fitting room photo saved');fittingRoomSetup()};reader.readAsDataURL(file);
  };
}

function tryOnProduct(productId){
  const product=(window.catalogProducts||[]).find(p=>p.id===productId) || (typeof products!=='undefined'?products.find(p=>p.id===productId):null);
  if(!product){toast('That product is not available in the current catalogue');return}
  SuitedFitRoom.currentProduct=product;
  if(!SuitedFitRoom.getPhoto()){toast('Add your fitting-room photo first');setTimeout(fittingRoomSetup,350);return}
  renderTryOn(product);
}

function renderTryOn(product){
  const photo=SuitedFitRoom.getPhoto();
  const fit=SuitedFitRoom.fitAssessment(product);
  const sizeText=Array.isArray(product.sizes)&&product.sizes.length?product.sizes.join(' · '):(product.sizesText||'Check retailer');
  app.innerHTML=`<section><div class="section-head"><div><span class="eyebrow">VIRTUAL FITTING ROOM</span><h1>Try it with your profile.</h1><p class="subtext">A V1 fit preview for ${escapeHtml(product.name)} from ${escapeHtml(product.retailer)}.</p></div><button class="secondary" onclick="fittingRoomSetup()">Fitting room settings</button></div><div class="tryon-stage"><div class="tryon-person"><span class="tryon-label">YOU</span><img src="${photo}" alt="Your fitting room photo"></div><div class="tryon-product"><span class="tryon-label">SELECTED PIECE</span><img src="${product.image||imageForProduct(product)}" alt="Style preview for ${escapeHtml(product.name)}"><div class="tryon-product-info"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.retailer)} · ${money(product.sale||product.price)}</span></div></div><div class="fit-verdict ${fit.available?'good':'check'}"><span class="eyebrow">SUITED FIT CHECK</span><h2>${fit.available?'Promising size match':'Check sizing before buying'}</h2>${fit.notes.map(n=>`<p>${escapeHtml(n)}</p>`).join('')}<p>Retailer-listed sizes: ${escapeHtml(String(sizeText))}</p><div class="actions"><button class="primary" onclick="shop('${product.url}')">View at ${escapeHtml(product.retailer)} ↗</button><button class="secondary" onclick="ask()">Try another item</button></div></div></div><div class="ai-next-card"><span class="eyebrow">AI TRY-ON READY</span><h3>Next connection: render the garment on your image.</h3><p>This screen already passes the customer photo, body profile and selected catalogue product into one workflow. When the image-generation backend is connected, the centre preview can be replaced by a generated image of the shopper wearing the selected item.</p></div></section>`;
}

function installFittingRoomButtons(){
  const original=window.productCard;
  if(!original||original.__fitWrapped)return;
  const wrapped=function(x){
    const base=original(x);
    return base.replace('</div></article>',`<button class="secondary tryon-button" onclick="tryOnProduct('${String(x.id).replace(/'/g,"\\'")}')">Try on me</button></div></article>`);
  };
  wrapped.__fitWrapped=true;
  window.productCard=wrapped;
}

setTimeout(installFittingRoomButtons,100);
