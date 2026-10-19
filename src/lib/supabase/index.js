export {
  supabase,
  getSupabaseClient,
  getAuthRedirectUrl,
  isSupabaseConfigured,
  supabaseConfigError,
} from '@/lib/supabase/client';
export { validatePassword } from '@/lib/supabase/password';
export {
  signIn,
  sendPhoneOtp,
  verifyPhoneOtp,
  sendEmailOtp,
  verifyEmailOtp,
  signUp,
  resetPassword,
  updatePassword,
  unlockAccount,
} from '@/lib/supabase/auth';
export { getProfile, upsertProfile } from '@/lib/supabase/profile';
export { uploadMedia } from '@/lib/supabase/media';
export {
  loadRemoteState,
  loadRemoteOrders,
  loadRemoteChats,
  persistChatMessage,
  persistChatMessageRead,
  persistShopRating,
  persistOrderStatus,
  persistState,
  deleteSupabaseNotification,
  deleteSupabaseAccount,
  resetSupabaseData,
} from '@/lib/supabase/state';
