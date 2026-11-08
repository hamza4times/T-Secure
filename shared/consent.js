export function pendingConsentFor(serialized,uid) {
  try {
    const value=JSON.parse(serialized);
    return value?.uid===uid && value.enabled===true;
  } catch {return false;}
}
