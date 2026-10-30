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
  changePassword,
  unlockAccount,
} from '@/lib/supabase/auth';
export { getProfile, upsertProfile } from '@/lib/supabase/profile';
export { uploadMedia } from '@/lib/supabase/media';
export {
  loadRemoteState,
  loadRemoteOrders,
  persistNewOrder,
  loadRemoteChats,
  persistChatMessage,
  persistChatMessageRead,
  persistShopRating,
  getShopRatingComments,
  persistAdminMarketplacePost,
  reportSupabasePost,
  reportSupabaseAccount,
  resolveSupabaseAccountReport,
  persistMarketplaceComment,
  deleteMarketplaceComment,
  persistOrderStatus,
  persistState,
  deleteSupabaseNotification,
  markSupabaseNotificationRead,
  markAllSupabaseNotificationsRead,
  persistAdminPostModeration,
  deleteSupabasePost,
  deleteSupabaseAccount,
  resetSupabaseData,
} from '@/lib/supabase/state';
