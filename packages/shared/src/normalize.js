// Same fold as Ciro._fold. Payment decisions still go through the contract.
// This copy exists so the API can reject an empty name before it returns calldata,
// and so a test can compare keccak256(fold(name)) with the hash stored on chain.

export function fold(name) {
  const raw = new TextEncoder().encode(String(name));
  const buf = [];
  let prevSpace = true;
  for (let i = 0; i < raw.length; i++) {
    let c = raw[i];
    if (c >= 0x41 && c <= 0x5a) c += 32;
    const alnum = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39);
    if (alnum) {
      buf.push(c);
      prevSpace = false;
    } else if (c === 0x20 && !prevSpace) {
      buf.push(0x20);
      prevSpace = true;
    }
  }
  if (buf.length > 0 && buf[buf.length - 1] === 0x20) buf.pop();
  return Uint8Array.from(buf);
}

export function isEmptyName(name) {
  return fold(name).length === 0;
}
