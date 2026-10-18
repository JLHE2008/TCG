import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
export function fileStore(root){return {async read(key){try{return JSON.parse(await readFile(join(root,key),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},async put(key,value){const dest=join(root,key);await mkdir(join(dest,'..'),{recursive:true});const tmp=dest+'.'+crypto.randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value));await rename(tmp,dest);}};}
export function normalizeGroup(products,prices,group,language){
 const quotes=new Map();for(const p of prices){const list=quotes.get(p.productId)||[];list.push({variant:p.subTypeName,market:p.marketPrice??null,low:p.lowPrice??null,mid:p.midPrice??null});quotes.set(p.productId,list);}
 return products.flatMap(p=>{const ext=Object.fromEntries((p.extendedData||[]).map(e=>[e.name,e.value]));if(!ext.Number&&!ext.Rarity)return [];return [{id:'t'+p.productId,productId:p.productId,name:p.name,language,source:'market',setId:String(group.groupId),set:group.name,number:ext.Number||'',rarity:ext.Rarity||'',type:ext['Card Type']||'',image:p.imageUrl,url:p.url,date:group.publishedOn?.slice(0,10)||'',dateBasis:'provider set date',presale:p.presaleInfo?.isPresale||false,prices:quotes.get(p.productId)||[]}];});
}
export function observation(catalog){const prices={};for(const c of catalog.cards)for(const p of c.prices)if(typeof p.market==='number'&&p.market>0)prices[c.id+'|'+p.variant]=p.market;return {day:catalog.updated.slice(0,10),updated:catalog.updated,prices};}
export async function refreshMarket(store,{fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>new Date()}={}){
 const get=async(url,text=false,empty=false)=>{let error;for(let n=0;n<3;n++){try{const r=await fetcher(url,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{Accept:text?'text/plain':'application/json'}});if(empty&&r.status===404)return {results:[]};if(!r.ok)throw new Error('Provider HTTP '+r.status);return text?r.text():r.json();}catch(e){error=e;if(n<2)await pause(1000*(n+1));}}throw error;};
 const updated=new Date((await get('https://tcgcsv.com/last-updated.txt',true)).trim()).toISOString(),runId=updated.replace(/[^0-9]/g,''),prior=await store.read('current.json');
 if(prior?.updated===updated)return {...prior,unchanged:true};
 const catalogs={},counts={};
 for(const [language,category] of [['en',3],['ja',85]]){
  const groups=(await get(`https://tcgcsv.com/tcgplayer/${category}/groups`)).results;if(!Array.isArray(groups)||!groups.length)throw new Error('Empty group list; previous data preserved');
  const cards=[];
  for(const group of groups){const key=`staging/${runId}/${language}/${group.groupId}.json`;let rows=await store.read(key);if(!rows){const products=await get(`https://tcgcsv.com/tcgplayer/${category}/${group.groupId}/products`,false,true);await pause(175);const prices=await get(`https://tcgcsv.com/tcgplayer/${category}/${group.groupId}/prices`,false,true);await pause(175);if(!Array.isArray(products.results)||!Array.isArray(prices.results))throw new Error('Malformed product group; previous data preserved');rows=normalizeGroup(products.results,prices.results,group,language);await store.put(key,rows);}cards.push(...rows);}
  // Provider omissions never delete previously saved cards; stale rows are explicit.
  const old=prior?await store.read(`runs/${prior.runId}/catalog-${language}.json`):null,incoming=new Set(cards.map(c=>c.id)),retained=(old?.cards||[]).filter(c=>!incoming.has(c.id)).map(c=>({...c,retained:true,priceAsOf:c.priceAsOf||old.updated,lastPrices:c.lastPrices||c.prices,prices:[]}));cards.push(...retained);
  if(!cards.length)throw new Error('Empty catalog; previous data preserved');
  const catalog={updated,cards,groups,failures:[],retained:retained.length};catalogs[language]=catalog;counts[language]={cards:cards.length,priced:cards.filter(c=>c.prices.some(p=>typeof p.market==='number'&&p.market>0)).length,unpriced:cards.filter(c=>!c.prices.some(p=>typeof p.market==='number'&&p.market>0)).length,retained:retained.length,sets:groups.length};
 }
 // Write both complete catalogs and source-dated observations before swapping the pointer.
 // Retained old rows remain visible but do not produce a new-day observation.
 for(const language of ['en','ja']){const catalog=catalogs[language];await store.put(`runs/${runId}/catalog-${language}.json`,catalog);const snap=observation({...catalog,cards:catalog.cards.filter(c=>!c.retained)});await store.put(`history/${snap.day}/${language}.json`,snap);}
 const dates=await store.read('history/dates.json')||[],day=updated.slice(0,10);await store.put('history/dates.json',[...new Set([...dates,day])].sort());
 let fx=prior?.fx||null;try{const quote=await get('https://api.frankfurter.dev/v1/latest?base=USD&symbols=MYR,EUR,JPY');if(quote.date&&quote.rates?.MYR)fx=quote;}catch{}
 const result={runId,updated,sourceUpdated:updated,runComplete:true,builtAt:now().toISOString(),checkedAt:now().toISOString(),market:counts,fx,history:{firstObserved:[...dates,day].sort()[0]},scheduler:'Independent service · daily 06:00 Asia/Kuala_Lumpur'};
 await store.put(`runs/${runId}/metadata.json`,result);await store.put('current.json',result);return result;
}
export async function historyFor(store,language,id,variant,days){const dates=await store.read('history/dates.json')||[];if(!dates.length)return {points:[],changes:{1:null,7:null,30:null,365:null}};const latest=dates.at(-1),anchor=Date.parse(latest+'T00:00:00Z'),points=[];for(const date of dates.filter(d=>anchor-Date.parse(d+'T00:00:00Z')<=days*86400000)){const snap=await store.read(`history/${date}/${language}.json`),price=snap?.prices?.[id+'|'+variant];if(typeof price==='number')points.push({date,price});}const current=(await store.read(`history/${latest}/${language}.json`))?.prices?.[id+'|'+variant],changes={};for(const n of [1,7,30,365]){const date=new Date(anchor-n*86400000).toISOString().slice(0,10),before=(await store.read(`history/${date}/${language}.json`))?.prices?.[id+'|'+variant];changes[n]=typeof current==='number'&&typeof before==='number'&&before>0?(current-before)/before*100:null;}return {points,changes,latest,firstObserved:dates[0],variant,currency:'USD'};}
// A day rolls at 06:00 Kuala Lumpur (UTC+8), not midnight UTC.
export const scheduleDay=(time=Date.now())=>new Date(time+2*3600000).toISOString().slice(0,10);
