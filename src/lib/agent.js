// The single account allowed to see the Admin Panel and approve/reject token
// requests. Kept as a plain constant (not a Firestore-stored role) so it can
// never be tampered with by any user, including the admin's own account data.
export const ADMIN_EMAIL = 'toolsaayushman@gmail.com';

export function isAdmin(user) {
  return !!user && user.email === ADMIN_EMAIL;
}
