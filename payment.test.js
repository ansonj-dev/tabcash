import test from "node:test";
import assert from "node:assert/strict";
import { assertPaymentMatches } from "./payment.js";
const fixture=()=>({version:2,locktime:0,inputs:[{outpointTransactionHash:new Uint8Array(32),outpointIndex:0,sequenceNumber:0xffffffff,unlockingBytecode:new Uint8Array()}],outputs:[{valueSatoshis:600n,lockingBytecode:new Uint8Array([1])},{valueSatoshis:1000n,lockingBytecode:new Uint8Array([2])}]});
test("wallet may add a signature while preserving the exact approved payment",()=>{
  const expected=fixture(), signed=structuredClone(expected);
  signed.inputs[0].unlockingBytecode=new Uint8Array([1,2,3]);
  assert.doesNotThrow(()=>assertPaymentMatches(signed,expected));
});
test("wallet cannot alter input, recipient, amount, change, version or locktime",()=>{
  for(const mutate of [s=>s.version++,s=>s.locktime++,s=>s.inputs.push(s.inputs[0]),s=>s.inputs[0].outpointTransactionHash[0]++,s=>s.inputs[0].outpointIndex++,s=>s.inputs[0].sequenceNumber--,s=>s.outputs.pop(),s=>s.outputs[0].valueSatoshis++,s=>s.outputs[1].valueSatoshis++,s=>s.outputs[0].lockingBytecode[0]++,s=>s.outputs[1].lockingBytecode[0]++,s=>s.outputs[0].token={}]) {
    const expected=fixture(), signed=structuredClone(expected);mutate(signed);
    assert.throws(()=>assertPaymentMatches(signed,expected),/broadcast stopped/);
  }
});
