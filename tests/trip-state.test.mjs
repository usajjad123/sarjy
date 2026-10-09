import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/trips/model.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { applyTripAction, emptyWorkspace, activeTrip } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const act = (workspace,name,args) => applyTripAction(workspace,{name,args});
const trip = () => act(emptyWorkspace(),"create_trip",{destination:"Kyoto, Japan", startDate:"2026-10-11",durationDays:3,interests:["food"]});

test("date shifting updates all days without losing itinerary IDs", () => {
  const original = trip();
  const shifted = act(original,"update_trip",{startDate:"2026-10-20"});
  assert.deepEqual(activeTrip(shifted).days.map(d=>d.date),["2026-10-20","2026-10-21","2026-10-22"]);
  assert.equal(activeTrip(shifted).days[0].id,activeTrip(original).days[0].id);
  assert.equal(activeTrip(original).startDate,"2026-10-11");
});
test("rejects impossible dates and invalid activity times", () => {
  assert.throws(()=>act(emptyWorkspace(),"create_trip",{destination:"Kyoto",startDate:"2026-02-30",durationDays:2}));
  assert.throws(()=>act(trip(),"add_activity",{day:1,title:"Walk",time:"25:00"}));
});
test("fixed activities survive day rewrites and cannot be edited, removed or moved", () => {
  let ws=act(trip(),"add_activity",{day:1,title:"Museum reservation",locked:true});
  const fixed=activeTrip(ws).days[0].activities[0];
  for(const [name,args] of [["remove_activity",{activityId:fixed.id}],["move_activity",{activityId:fixed.id,toDay:2}],["update_activity",{activityId:fixed.id,title:"Changed"}],["set_day_plan",{day:1,activities:[]}]]) assert.throws(()=>act(ws,name,args));
  ws=act(ws,"set_day_plan",{day:1,activities:[fixed,{title:"Lunch",kind:"food",time:"13:00"}]});
  assert.deepEqual(activeTrip(ws).days[0].activities[0],fixed);
  ws=act(ws,"update_activity",{activityId:fixed.id,locked:false});
  ws=act(ws,"move_activity",{activityId:fixed.id,toDay:2});
  assert.equal(activeTrip(ws).days[1].activities[0].id,fixed.id);
});
test("memory corrections replace one fact and trip edits never change memories", () => {
  let ws=act(trip(),"remember_fact",{key:"favorite_color",value:"green"});
  ws=act(ws,"remember_fact",{key:"favorite_color",value:"blue"});
  ws=act(ws,"add_activity",{day:1,title:"Breakfast",kind:"food"});
  assert.equal(ws.memories.length,1);
  assert.equal(ws.memories[0].value,"blue");
  ws=act(ws,"forget_fact",{key:"favorite_color"});
  assert.equal(ws.memories.length,0);
});
test("day replacement rejects foreign IDs and duplicate stops", () => {
  let ws=act(trip(),"add_activity",{day:1,title:"Walk"});
  const stop=activeTrip(ws).days[0].activities[0];
  assert.throws(()=>act(ws,"set_day_plan",{day:2,activities:[stop]}));
  assert.throws(()=>act(ws,"set_day_plan",{day:1,activities:[stop,stop]}));
});
