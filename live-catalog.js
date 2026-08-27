let catalogProducts=[];
let catalogMeta={generatedAt:null,count:0,status:'loading'};

const catalogImages={
  wedding:'https://unsplash.com/photos/5-Gyzo506fg/download?force=true&w=900',
  night:'https://unsplash.com/photos/2TVr__2eMbM/download?force=true&w=900',
  work:'https://unsplash.com/photos/SS1Oldoervo/download?force=true&w=900',
  casual:'https://unsplash.com/photos/qmyebfKk3pw/download?force=true&w=900',
  feminine:'https://unsplash.com/photos/pnabbBAK7ls/download?force=true&w=900',
  classic:'https://unsplash.com/photos/Vj6PZFCxhec/download?force=true&w=900'
};

function imageForProduct(p){
  const occasion=(p.occasion||[])[0];
  const style=(p.styles||[])[0];
  return p.image || catalogImages[occasion] || catalogImages[style] || catalogImages.classic;
}

function normaliseCatalogProduct(p){
  return {
    ...p,
    sale:p.sale??null,
    price:Number(p.price||0),
    sizes:Array.isArray(p.sizes)?p.sizes.map(String):[],
    sizesText:Array.isArray(p.sizes)&&p.sizes.length?p.sizes.join(' · '):'Check retailer',
    colour:p.colour||'Check retailer',
    occasion:Array.isArray(p.occasion)?p.occasion:[],
    styles:Array.isArray(p.styles)?p.styles:[],
    image:imageForProduct(p)
  };
}

async function loadLiveCatalog(){
  try{
    const res=await fetch(`data/catalog.json?v=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
    const data=await res.json();
    catalogProducts=(data.products||[]).map(normaliseCatalogProduct);
    catalogMeta={generatedAt:data.generatedAt||null,count:catalogProducts.length,status:'live'};
    installCatalogOverrides();
    if(typeof home==='function') home();
  }catch(err){
    console.warn('Suited live catalog unavailable; using built-in fallback products.',err);
    catalogMeta.status='fallback';
  }
}

function catalogFreshness(){
  if(!catalogMeta.generatedAt) return 'Catalogue snapshot';
  const d=new Date(catalogMeta.generatedAt);
  return Number.isNaN(d.getTime())?'Catalogue snapshot':`Catalogue refreshed ${d.toLocaleDateString('en-NZ',{day:'numeric',month:'short'})} ${d.toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit'})}`;
}

function installCatalogOverrides(){
  window.matchedProducts=function(key,budget,p){
    const source=catalogProducts.length?catalogProducts:[];
    const requestedSize=String(p?.size||'');
    let list=source.filter(x=>x.occasion.includes(key)&&(x.sale||x.price)<=budget);
    if(requestedSize){
      const exact=list.filter(x=>!x.sizes.length||x.sizes.includes(requestedSize));
      if(exact.length) list=exact;
    }
    const style=String(p?.style||'').toLowerCase();
    const favs=String(p?.retailers||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
    list.sort((a,b)=>{
      const bs=(b.styles.includes(style)?3:0)+(favs.some(r=>b.retailer.toLowerCase().includes(r))?2:0);
      const as=(a.styles.includes(style)?3:0)+(favs.some(r=>a.retailer.toLowerCase().includes(r))?2:0);
      return bs-as;
    });
    if(!list.length) list=source.filter(x=>(x.sale||x.price)<=budget);
    return list.slice(0,12);
  };

  window.productCard=function(x){
    const sale=x.sale;
    const sizes=x.sizesText||x.sizes||'Check retailer';
    return `<article class="product-card"><div class="product-image"><img src="${x.image}" alt="Style preview for ${escapeHtml(x.name)}" loading="lazy"><span class="preview-chip">STYLE PREVIEW</span><span class="retailer-chip">${escapeHtml(x.retailer)}</span></div><div class="product-body"><h3>${escapeHtml(x.name)}</h3><p class="product-meta">${escapeHtml(x.colour||'Check retailer')} · Sizes ${escapeHtml(String(sizes))}</p><div class="product-price">${sale?`<strong>${money(sale)}</strong><del>${money(x.price)}</del>`:`<strong>${money(x.price)}</strong>`}</div><button class="primary retailer-button" onclick="shop('${x.url}')">View at ${escapeHtml(x.retailer)} ↗</button></div></article>`;
  };

  window.home=function(){
    const featured=catalogProducts.slice(0,6);
    app.innerHTML=`
    <section class="hero hero-photo-layout">
      <div class="hero-copy"><span class="eyebrow">YOUR PERSONAL SHOPPING ASSISTANT</span><h1>Style that feels like <em>you.</em></h1><p>Build your profile once. Suited uses your size, fit preferences, style and budget to create complete looks — then matches them against the current Suited retailer catalogue.</p><div class="actions"><button class="primary large" onclick="profile()">Build my style profile</button><button class="secondary large" onclick="ask()">Ask Suited</button></div><div class="trust-row"><span class="tag">NZ sizes 6–20</span><span class="tag">Live catalogue</span><span class="tag">Complete outfits</span><span class="tag">Budget aware</span></div></div>
      <div class="hero-photo-wrap"><img src="${editorial.hero}" alt="Editorial fashion style inspiration"><div class="hero-photo-card"><span class="eyebrow">THE SUITED IDEA</span><strong>One profile.<br>Less scrolling.</strong><small>${catalogFreshness()} · ${catalogMeta.count} products</small></div></div>
    </section>
    <section class="retailer-strip"><span>AUTOMATED RETAILER CATALOGUE</span><strong>Seed Heritage</strong><strong>Max</strong><strong>Country Road</strong><small>${catalogFreshness()} · the catalogue job can add/remove products without editing this webpage.</small></section>
    <section class="home-products"><div class="section-head compact"><div><span class="eyebrow">SHOP FROM THE CATALOGUE</span><h2>Current pieces Suited can recommend.</h2><p class="subtext">This section now reads from <code>data/catalog.json</code>, the file produced by the automated catalogue pipeline.</p></div><button class="secondary" onclick="ask()">Personalise these →</button></div>${featured.length?`<div class="product-grid">${featured.map(productCard).join('')}</div>`:`<div class="empty"><h2>Catalogue refresh in progress.</h2><p>Suited will show products here as soon as the catalogue contains them.</p></div>`}<p class="freshness-note">${catalogFreshness()}. Retailer stock and prices should still be confirmed on the retailer site before purchase.</p></section>`;
    updateBadge();
  };

  window.resultsFromLook=function(occasion){
    const p=get('profile',{});
    const found=matchedProducts(occasion,Number(p.budget||9999),p);
    app.innerHTML=`<section class="panel"><span class="eyebrow">LIVE RETAILER CATALOGUE</span><h1>Pieces for your ${escapeHtml(occasion)} look.</h1><p class="subtext">Filtered from the current catalogue by your budget, size, style and favourite retailers.</p>${found.length?`<div class="product-grid">${found.map(productCard).join('')}</div>`:`<div class="empty"><h2>No catalogue matches yet.</h2><p>Try changing your budget or profile while the catalogue expands.</p></div>`}<p class="freshness-note">${catalogFreshness()}</p><div class="actions"><button class="secondary" onclick="ask()">Refine with Ask Suited</button></div></section>`;
  };
}

loadLiveCatalog();
