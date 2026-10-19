import {publicStore,publishPublic} from './public-store.mjs';
import {refreshMarket} from './refresh.mjs';
const store=await publicStore('data','.work');
const metadata=await refreshMarket(store);
const manifest=await publishPublic(store,'data',metadata);
console.log(JSON.stringify({sourceUpdated:metadata.sourceUpdated,market:metadata.market,dates:manifest.dates,checkedAt:manifest.metadata.checkedAt,unchanged:!!metadata.unchanged}));
