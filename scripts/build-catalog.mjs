import fs from 'node:fs/promises';

const config=JSON.parse(await fs.readFile('catalog.config.json','utf8'));
const seed=JSON.parse(await fs.readFile('data/catalog.seed.json','utf8').catch(()=> '[]'));

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const number=v=>{const n=Number(String(v??'').replace(/[^0-9.]/g,''));return Number.isFinite(n)?n:null};
const uniq=a=>[...new Set(a.filter(Boolean))];
const normalise=p=>({
 id:clean(p.id||`${p.retailer}-${p.name}`).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
 retailer:clean(p.retailer),name:clean(p.name),category:clean(p.category||'clothing'),
 price:number(p.price),sale:number(p.sale),currency:'NZD',colour:clean(p.colour),
 sizes:uniq(Array.isArray(p.sizes)?p.sizes.map(String):String(p.sizes||'').split(/[,/]/).map(clean)),
 url:clean(p.url),image:clean(p.image),occasion:uniq(p.occasion||[]),styles:uniq(p.styles||[]),
 updatedAt:new Date().toISOString()
});

async function fetchText(url){const r=await fetch(url,{headers:{'user-agent':'SuitedCatalogBot/1.0 (+https://suited111.github.io/Suited-v1/)','accept':'text/html,application/xhtml+xml'}});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.text()}
function jsonLdProducts(html,retailer){const blocks=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];const out=[];for(const b of blocks){try{const raw=JSON.parse(b[1]);const nodes=Array.isArray(raw)?raw:(raw['@graph']||[raw]);for(const n of nodes){if(n?.['@type']==='Product'){const offer=Array.isArray(n.offers)?n.offers[0]:n.offers||{};out.push(normalise({retailer,name:n.name,price:offer.price||offer.lowPrice,url:offer.url||n.url,image:Array.isArray(n.image)?n.image[0]:n.image,colour:n.color,sizes:[]}))}}}catch{}}return out}

async function discoverUrls(source){const html=await fetchText(source.url);if(source.type==='sitemap'){return uniq([...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).filter(u=>/^https?:/.test(u)&&!/sitemap\/?$/i.test(u))).slice(0,120)}return [source.url]}

const live=[];
for(const retailer of config.retailers){for(const source of retailer.sources||[]){try{const urls=await discoverUrls(source);for(const url of urls.slice(0,80)){try{const html=await fetchText(url);live.push(...jsonLdProducts(html,retailer.name))}catch{}}}catch(e){console.warn(`Catalog source unavailable: ${retailer.name}: ${e.message}`)}}}

const merged=new Map();for(const p of [...seed,...live].map(normalise)){if(p.name&&p.retailer&&p.url)merged.set(p.url,p)}
const products=[...merged.values()].filter(p=>p.price!==null).sort((a,b)=>a.retailer.localeCompare(b.retailer)||a.name.localeCompare(b.name));
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/catalog.json',JSON.stringify({generatedAt:new Date().toISOString(),count:products.length,products},null,2));
console.log(`Built catalog with ${products.length} products`);