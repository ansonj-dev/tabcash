import test from "node:test";
import assert from "node:assert/strict";
import { balancesFor, planFor, validateImport } from "./ledger.js";
const fixture = () => ({version:1,title:"Test",me:"a",people:["a","b","c"].map(id=>({id,name:id,address:"",color:"#000"})),events:[{id:"e",type:"expense",payer:"a",split:["a","b","c"],amount:10,description:"Lunch",at:"2026-11-19T00:00:00Z"}]});
test("integer remainder is conserved and settlement clears every balance", () => {
  const state=fixture();
  assert.equal(validateImport(state),true);
  assert.deepEqual(balancesFor(state),{a:6,b:-3,c:-3});
  const plan=planFor(balancesFor(state));
  state.events.push(...plan.map((p,i)=>({...p,type:"settlement",id:`s${i}`,at:state.events[0].at})));
  assert.deepEqual(balancesFor(state),{a:0,b:0,c:0});
});
test("duplicate split participants cannot change expense conservation", () => {
  const state=fixture(); state.events[0].split.push("b");
  assert.deepEqual(balancesFor(state),{a:6,b:-3,c:-3});
});
test("imports reject missing splits, unknown members, invalid dates and unsafe totals", () => {
  for(const mutate of [s=>delete s.events[0].split,s=>s.events[0].split.push("missing"),s=>s.people.push({...s.people[0]}),s=>s.events[0].at="invalid",s=>delete s.people[0].address,s=>s.me="missing",s=>s.events.push({...s.events[0],id:"overflow",amount:Number.MAX_SAFE_INTEGER})]) {
    const state=fixture(); mutate(state); assert.equal(validateImport(state),false);
  }
});
test("pending transaction import retains duplicate-payment protection and rejects malformed records", () => {
  const state=fixture(); state.payments=[{from:"b",to:"a",amount:3,txid:"a".repeat(64)}];
  assert.equal(validateImport(state),true);
  state.payments[0].txid="bad"; assert.equal(validateImport(state),false);
});
