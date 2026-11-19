import test from "node:test";
import assert from "node:assert/strict";
import { hexToBin, publicKeyToP2pkhCashAddress, encodeCashAddressNonStandard } from "@bitauth/libauth";
import { isPublicHttpsUrl, isMainnetTokenAddress, validateSubmission } from "./submission-validation.js";
const key=hexToBin("0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
const address=(prefix,tokenSupport)=>publicKeyToP2pkhCashAddress({publicKey:key,prefix,tokenSupport}).address;
test("public submission links reject unsafe schemes, credentials, placeholders and private hosts",()=>{
  assert.equal(isPublicHttpsUrl("https://github.com/team/tabcash"),true);
  for(const value of ["",null,"http://github.com/team/tabcash","javascript:alert(1)","https://user:pass@github.com/team/tabcash","https://localhost/a","https://127.0.0.1/a","https://[::1]/a","https://192.168.1.2/a","https://10.1.2.3/a","https://172.16.0.1/a","https://100.64.0.1/a","https://example.com/a","https://demo.example.org/a","https://site.local/a","https://demo.invalid/a"," https://github.com/team/tabcash"]) assert.equal(isPublicHttpsUrl(value),false,String(value));
  assert.equal(isPublicHttpsUrl("https://git\nhub.com/team/tabcash"),false);
});
test("voting address must be a mainnet token-aware CashAddress with valid checksum",()=>{
  const valid=address("bitcoincash",true);
  assert.equal(isMainnetTokenAddress(valid),true);
  for(const value of [address("bitcoincash",false),address("bchtest",true),valid.slice(12),valid.slice(0,-1)+(valid.endsWith("q")?"p":"q"),null,{}]) assert.equal(isMainnetTokenAddress(value),false);
  const unsupported=encodeCashAddressNonStandard({prefix:"bitcoincash",typeBits:2,payload:new Uint8Array(24)}).address;
  assert.equal(isMainnetTokenAddress(unsupported),false);
});
test("blank config remains blocked; complete public formats do not assert event eligibility",()=>{
  assert.equal(validateSubmission().ready,false);
  assert.equal(validateSubmission(null).checks.filter(c=>!c.valid).length,3);
  const report=validateSubmission({widgetFactorySlideUrl:"https://slides.google.com/presentation/d/public-id",sourceRepositoryUrl:"https://github.com/team/tabcash",ember2026DonationAddress:address("bitcoincash",true)});
  assert.equal(report.ready,true);
  assert.match(report.notice,/separate evidence/);
});
