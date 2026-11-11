import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';

const HOUR=60*60*1000;
export function auditManifest(manifest,{now=Date.now(),checkBlob=()=>Promise.resolve()}={}){
 const problems=[],warnings=[];
 if(!manifest||manifest.schema!==1||!manifest.metadata?.runComplete){
  return {ok:false,problems:['Missing or incomplete manifest'],warnings,stats:{}};
 }
 const m=manifest.metadata,checked=Date.parse(m.checkedAt),source=Date.parse(m.sourceUpdated);
 if(!Number.isFinite(checked)||checked>now+HOUR||now-checked>48*HOUR)problems.push('Last completed check is over 48 hours old or invalid');
 if(!Number.isFinite(source)||source>now+HOUR||now-source>72*HOUR)problems.push('Provider pricing data is over 72 hours old or invalid');
 if(!Array.isArray(manifest.dates)||!manifest.dates.length||manifest.dates.at(-1)!==m.history?.lastObserved)problems.push('Observation dates and metadata disagree');
 const stats={checkedAt:m.checkedAt,sourceUpdated:m.sourceUpdated,observations:manifest.dates?.length||0,languages:{}};
 for(const lang of ['en','ja']){
  const s=m.market?.[lang];
  if(!s||!Number.isInteger(s.cards)||s.cards<=0||s.priced+s.unpriced!==s.cards||s.sets<=0)
   problems.push('Invalid or empty '+lang+' catalog counts');
  else {
   stats.languages[lang]={cards:s.cards,priced:s.priced,sets:s.sets};
   if(s.priced===0)problems.push('No priced cards in '+lang);
  }
  if(!/^blobs\/[a-f0-9]{64}\.json\.gz$/.test(manifest.catalogs?.[lang]||''))problems.push('Missing '+lang+' catalog blob reference');
  if(Object.keys(manifest.histories?.[lang]||{}).length!==64)problems.push('Incomplete '+lang+' price-history shards');
 }
 const fxDate=Date.parse((m.fx?.date||'')+'T00:00:00Z');
 if(!Number.isFinite(fxDate)||now-fxDate>96*HOUR)warnings.push('Currency conversion data may be stale');
 return {ok:problems.length===0,problems,warnings,stats};
}
export async function main(root='data'){
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 const result=auditManifest(manifest);
 for(const lang of ['en','ja']){
  const file=manifest.catalogs?.[lang];
  if(file)try{await access(join(root,file));}catch{result.problems.push('Missing '+lang+' catalog file');}
  for(const path of Object.values(manifest.histories?.[lang]||{}))try{await access(join(root,path));}catch{result.problems.push('Missing history shard '+path);}
 }
 result.ok=result.problems.length===0;
 console.log(JSON.stringify({status:result.ok?'healthy':'unhealthy',...result},null,2));
 if(!result.ok)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)await main(process.argv[2]||'data');
