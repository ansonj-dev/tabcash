import { cashAddressToLockingBytecode } from "@bitauth/libauth";
export const validMainnetAddress = (value) => {
  if (typeof value !== "string" || !value.startsWith("bitcoincash:"))
    return false;
  return typeof cashAddressToLockingBytecode(value) !== "string";
};
