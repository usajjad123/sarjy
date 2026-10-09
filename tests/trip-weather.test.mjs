import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const moduleUrl=(code)=>`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile=(path)=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const modelUrl=moduleUrl(compile("../src/lib/trips/model.ts"));
const {applyTripAction,emptyWorkspace,activeTrip}=await import(modelUrl);
const weatherUrl=moduleUrl(compile("../src/lib/trips/weather.ts").replaceAll('from "./model"',`from "${modelUrl}"`));
const {getWeather,tripExperience}=await import(weatherUrl);
const today=new Date().toISOString().slice(0,10);
const trip=(startDate=today)=>activeTrip(applyTripAction(emptyWorkspace(),{name:"create_trip",args:{destination:"Kyoto, Japan",startDate,durationDays:1,interests:["food"],pace:"relaxed"}}));
const geo={results:[{name:"Kyoto",country:"Japan",country_code:"JP",latitude:35,longitude:135,timezone:"UTC"}]};

test("forecast numbers come from the external response and shape a cautious experience",async(t)=>{
  t.mock.method(globalThis,"fetch",async(url)=>({ok:true,json:async()=>url.hostname.includes("geocoding")?geo:{daily:{time:[today],weather_code:[61],temperature_2m_max:[22],temperature_2m_min:[16],precipitation_probability_max:[75],wind_speed_10m_max:[12]}}}));
  const report=await getWeather(trip(),true);
  assert.equal(report.status,"ready");assert.equal(report.days[0].rainChance,75);assert.equal(report.days[0].high,22);
  assert.match(tripExperience(trip(),report).title,/Cozy/);
});
test("distant trip dates do not fabricate weather or call the forecast endpoint",async(t)=>{
  let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;return{ok:true,json:async()=>geo};});
  const report=await getWeather(trip("2099-01-01"),true);
  assert.equal(report.status,"out_of_range");assert.equal(report.days.length,0);assert.equal(calls,1);
  assert.match(tripExperience(trip("2099-01-01"),report).body,/hasn’t been confirmed/);
});
test("network failures return unavailable without invented values",async(t)=>{
  t.mock.method(globalThis,"fetch",async()=>{throw new Error("network down");});
  const report=await getWeather(trip(),true);
  assert.equal(report.status,"unavailable");assert.deepEqual(report.days,[]);
});

test("unknown weather codes do not become a fabricated thunderstorm",async(t)=>{
  t.mock.method(globalThis,"fetch",async(url)=>({ok:true,json:async()=>url.hostname.includes("geocoding")?geo:{daily:{time:[today],weather_code:[999],temperature_2m_max:[22],temperature_2m_min:[16]}}}));
  const report=await getWeather(trip(),true);
  assert.equal(report.status,"unavailable");assert.equal(report.days.length,0);
});
test("ambiguous cities request clarification instead of choosing a country",async(t)=>{
  let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;return{ok:true,json:async()=>({results:[{...geo.results[0],name:"Paris",country:"France",country_code:"FR"},{...geo.results[0],name:"Paris",country:"United States",country_code:"US"}]})};});
  const ambiguous=trip();ambiguous.destination="Paris";
  const report=await getWeather(ambiguous,true);
  assert.equal(report.status,"ambiguous");assert.equal(calls,1);assert.equal(report.days.length,0);
});
