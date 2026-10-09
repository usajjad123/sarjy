import assert from 'node:assert/strict';
const base=process.env.SARJY_TEST_URL||'http://127.0.0.1:3001';
let cookie='',workspace; const metrics=[];
async function request(path,body) { const start=performance.now();const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json',origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();metrics.push({command:body?.name||path,ms:Math.round(performance.now()-start),status:r.status});return{r,data}; }
async function act(name,args={},key=crypto.randomUUID(),expectedVersion=workspace.version) { let {r,data}=await request('/api/food-action',{name,args,callId:key,expectedVersion}); if (r.status === 502) ({r,data}=await request('/api/food-action',{name,args,callId:key,expectedVersion})); assert.equal(r.status,200,JSON.stringify(data));workspace=data.workspace;return data; }
({data:{workspace}}=await request('/api/workspace?timezone=Asia%2FRiyadh'));
await act('start_food_log',{date:'2026-10-09',mealName:'Lunch',items:[{query:'Chicken breast meat only cooked roasted',quantity:{amount:200,unit:'g'}}]});
const itemId=workspace.pending.items[0].id;
await act('search_food',{itemId});const candidates=workspace.pending.items[0].candidates;
assert.ok(candidates.length);
const match=candidates.find(c=>/breast.*meat only.*cooked.*roasted/i.test(c.name));assert.ok(match,'Expected cooked chicken USDA match');
await act('resolve_food',{itemId,fdcId:match.fdcId});
const batchId=workspace.pending.id;await act('commit_food_log',{batchId});assert.equal(workspace.meals.length,1);
const e=workspace.meals[0].entries[0];assert.equal(e.grams,200);assert.equal(e.food.source.provider,'USDA FoodData Central');
const id=crypto.randomUUID(),version=workspace.version;await act('update_quantity',{entryId:e.id,quantity:{amount:180,unit:'g'}},id);assert.equal(workspace.meals[0].entries[0].grams,180);
await act('update_quantity',{entryId:e.id,quantity:{amount:180,unit:'g'}},id,version);assert.equal(workspace.meals.length,1);
await act('undo',{operationId:workspace.operations.at(-1).id});assert.equal(workspace.meals[0].entries[0].grams,200);
await act('save_meal',{mealId:workspace.meals[0].id,name:'Usual lunch'});
const before=workspace.version;const stale=await request('/api/food-action',{name:'set_goals',args:{protein:160},callId:crypto.randomUUID(),expectedVersion:before-1});assert.equal(stale.r.status,409);
await act('remember_fact',{key:'favorite_color',value:'sage green'});
const fresh=await request('/api/workspace');assert.equal(fresh.data.workspace.memories[0].value,'sage green');assert.equal(fresh.data.workspace.savedMeals.length,1);
await act('log_saved_meal',{savedMealId:workspace.savedMeals[0].id,date:'2026-10-10'});
await act('commit_food_log',{batchId});assert.equal(workspace.meals.length,2);
const isolated=await fetch(base+'/api/workspace').then(r=>r.json());assert.equal(isolated.workspace.meals.length,0);
const cross=await fetch(base+'/api/food-action',{method:'POST',headers:{cookie,origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({name:'get_nutrition_context',args:{}})});assert.equal(cross.status,403);
console.log(JSON.stringify({passed:true,source:match,totalCalories:workspace.meals[0].entries[0].nutrients.calories,verified:['USDA resolution','log','correct','retry idempotency','undo','remember','saved meal replay','batch deduplication','stale conflict','guest isolation','origin rejection'],metrics},null,2));
