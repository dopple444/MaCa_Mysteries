export function getPostLoginRedirectPath(user: { emailVerifiedAt: Date | null }) {
  return user.emailVerifiedAt ? "/dashboard" : "/account/verify-email?sent=1";
}
