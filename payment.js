import { binToHex } from "@bitauth/libauth";

export function assertPaymentMatches(signed, expected) {
  const same = (a, b) => binToHex(a) === binToHex(b);
  if (
    signed.version !== expected.version ||
    signed.locktime !== expected.locktime ||
    signed.inputs.length !== 1 || signed.outputs.length !== 2 ||
    !same(signed.inputs[0].outpointTransactionHash, expected.inputs[0].outpointTransactionHash) ||
    signed.inputs[0].outpointIndex !== expected.inputs[0].outpointIndex ||
    signed.inputs[0].sequenceNumber !== expected.inputs[0].sequenceNumber ||
    signed.outputs.some((o, i) => o.token ||
      o.valueSatoshis !== expected.outputs[i].valueSatoshis ||
      !same(o.lockingBytecode, expected.outputs[i].lockingBytecode))
  ) throw Error("Signed transaction differs from the approved payment; broadcast stopped");
}
