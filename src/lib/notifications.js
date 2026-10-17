/*
  Account alerts, and who they are addressed to.

  This lives in its own module rather than in components/UI.jsx for one reason: a
  cycle. AppContext.jsx needs this predicate, and components/UI.jsx needs `useApp`
  to render toasts. Keeping both in UI.jsx made AppContext -> UI -> AppContext, and
  a cycle like that does not fail loudly. It fails as `useApp must be used within
  AppProvider` at runtime, from a component that *is* inside the provider -- because
  the module instance `UI.jsx` captured was initialised before
  `AppContext.jsx` finished evaluating, so it closed over a different context
  object than the one AppProvider was given. Nothing in the import graph looks
  wrong, and the app works until a route happens to mount a component through that
  edge.

  Nothing here may import from a component or from AppContext. It has to stay a
  leaf so the cycle cannot be reintroduced from this side.
*/

/*
  Account alerts (a new registration, a lockout after repeated failed logins) are
  created locally with `userId: 'admin'`, because at the moment they are raised
  nobody is signed in and there is no admin uuid to address them to.

  Once Supabase is connected the rows come back through `mapNotifications`, which
  sets `userId` to `notifications.user_id` -- the real uuid of whoever owned the
  row. The admin screens compared against the literal string 'admin', so those
  rows never matched and the badge stayed at zero even though the alert was
  there. Accepting either form is what makes the same comparison work in local
  mode, where the literal is all there is.
*/
export function isAdminNotification(notification, adminId) {
  if (!notification) return false;
  const userId = notification.userId;
  if (userId == null) return false;
  const str = String(userId);
  if (str === 'admin') return true;
  return adminId != null && str === String(adminId);
}
