// Firebase adapter placeholder.
// This MVP uses in-memory storage by default.
// To switch, install firebase-admin and wire Firestore calls here.

export function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID);
}
