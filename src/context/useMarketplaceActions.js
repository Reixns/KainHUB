import { useCallback } from 'react';
import { nextLocalId } from './persistence';
import { isWithinMessageLimits, messageLimitMessage } from '@/lib/textLimits';

export function useMarketplaceActions({
  setPosts,
  auth,
  showToast,
  persistAdminPostModeration,
  deleteSupabasePost,
  persistMarketplaceComment,
  deleteMarketplaceComment,
  persistAdminMarketplacePost,
  reportSupabasePost,
  isSupabaseConfigured,
}) {
  const addPost = useCallback(async (post) => {
    if (!isWithinMessageLimits(post?.content)) {
      showToast(messageLimitMessage(), 'error');
      return null;
    }
    const newPost = {
      // Was `Date.now() + Math.random()`. posts.legacy_id is `bigint`, and a
      // fractional value is rejected by Postgres on write (and round-trips
      // back as a different number, so the row could not be matched again).
      id: nextLocalId(),
      authorId: auth.user.id,
      authorRole: auth.role,
      authorName: auth.role === 'vendor' ? auth.user.name : auth.user.fullName,
      authorAvatar: auth.role === 'vendor' ? auth.user.logo : (auth.user.avatar || ''),
      vendorId: auth.role === 'vendor' ? auth.user.id : null,
      verified: auth.role === 'vendor' || auth.role === 'admin',
      ...post,
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString(),
      pinned: auth.role === 'admin' ? (post.pinned || false) : false,
      hidden: false,
    };
    if (auth.role === 'admin' && isSupabaseConfigured) {
      try {
        await persistAdminMarketplacePost(newPost);
      } catch (error) {
        console.error('[admin] marketplace announcement could not be saved:', error);
        showToast(error instanceof Error ? error.message : 'Could not publish the marketplace announcement.', 'error');
        return null;
      }
    }
    setPosts((p) => [newPost, ...p]);
    showToast(auth.role === 'admin' ? 'Marketplace announcement published!' : 'Post published!', 'success');
    return newPost;
  }, [setPosts, auth, showToast, isSupabaseConfigured, persistAdminMarketplacePost]);

  const toggleLikePost = useCallback((postId) => {
    if (!auth.user) return;
    const userId = auth.user.id;
    setPosts((list) => list.map((p) => {
      if (p.id !== postId) return p;
      const liked = p.likedBy.includes(userId);
      const likedBy = liked ? p.likedBy.filter((x) => x !== userId) : [...p.likedBy, userId];
      return { ...p, likes: likedBy.length, likedBy };
    }));
  }, [setPosts, auth]);

  const addComment = useCallback(async (postId, content) => {
    if (!auth.user || !content.trim()) return false;
    if (!isWithinMessageLimits(content)) {
      showToast(messageLimitMessage(), 'error');
      return false;
    }
    const name = auth.role === 'vendor' ? auth.user.name : auth.user.fullName;
    const avatar = auth.role === 'vendor' ? auth.user.logo : (auth.user.avatar || '');
    const now = new Date().toISOString();
    try {
      const comment = isSupabaseConfigured
        ? await persistMarketplaceComment(postId, content.trim(), auth.role)
        : {
            id: nextLocalId(),
            authorId: auth.user.id,
            authorName: name,
            authorAvatar: avatar,
            authorRole: auth.role,
            content: content.trim(),
            time: now,
            createdAt: now,
          };
      setPosts((list) => list.map((post) => String(post.id) === String(postId)
        ? { ...post, comments: [...(post.comments || []), comment], updatedAt: comment.createdAt || now }
        : post));
      showToast('Comment posted.', 'success');
      return true;
    } catch (error) {
      showToast(error.message || 'Unable to post your comment.', 'error');
      return false;
    }
  }, [setPosts, auth, showToast, isSupabaseConfigured, persistMarketplaceComment]);

  const deleteComment = useCallback(async (postId, commentId) => {
    if (!auth.user) return false;
    try {
      if (isSupabaseConfigured) {
        await deleteMarketplaceComment(postId, commentId, auth.role);
      }
      const updatedAt = new Date().toISOString();
      setPosts((list) => list.map((post) => String(post.id) === String(postId)
        ? {
            ...post,
            comments: (post.comments || []).filter((comment) => (
              String(comment.id) !== String(commentId)
              || (auth.role !== 'admin' && String(comment.authorId) !== String(auth.user.id))
            )),
            updatedAt,
          }
        : post));
      showToast('Comment deleted.', 'success');
      return true;
    } catch (error) {
      showToast(error.message || 'Unable to delete the comment.', 'error');
      return false;
    }
  }, [setPosts, auth, showToast, isSupabaseConfigured, deleteMarketplaceComment]);

  const deletePost = useCallback(async (postId) => {
    if (auth.role === 'admin' && isSupabaseConfigured) {
      try {
        await deleteSupabasePost(postId);
      } catch (error) {
        showToast(error.message || 'Unable to delete the post.', 'error');
        return;
      }
    }
    setPosts((list) => list.filter((p) => String(p.id) !== String(postId)));
    showToast('Post deleted.', 'success');
  }, [setPosts, showToast, auth.role, isSupabaseConfigured, deleteSupabasePost]);

  const togglePinPost = useCallback(async (post, pinned) => {
    if (auth.role !== 'admin') return;
    const updatedAt = new Date().toISOString();
    try {
      if (isSupabaseConfigured) await persistAdminPostModeration(post, { pinned });
      setPosts((list) => list.map((p) => String(p.id) === String(post.id) ? { ...p, pinned, updatedAt } : p));
      showToast(pinned ? 'Post pinned.' : 'Post unpinned.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to update the post pin.', 'error');
    }
  }, [setPosts, showToast, auth.role, isSupabaseConfigured, persistAdminPostModeration]);

  const toggleHidePost = useCallback(async (post, hidden) => {
    if (auth.role !== 'admin') return;
    const updatedAt = new Date().toISOString();
    try {
      if (isSupabaseConfigured) await persistAdminPostModeration(post, { hidden });
      setPosts((list) => list.map((p) => String(p.id) === String(post.id) ? { ...p, hidden, updatedAt } : p));
      showToast(hidden ? 'Post hidden.' : 'Post visible again.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to update the post visibility.', 'error');
    }
  }, [setPosts, showToast, auth.role, isSupabaseConfigured, persistAdminPostModeration]);

  const reportPost = useCallback(async (postId, reason) => {
    if (!auth.user) {
      showToast('Sign in to report a post.', 'error');
      return false;
    }
    if (!['Spam', 'Scam', 'Inappropriate', 'Fake Promotion', 'Offensive', 'Other'].includes(reason)) {
      showToast('Choose a valid reason for reporting this post.', 'error');
      return false;
    }
    try {
      if (isSupabaseConfigured) await reportSupabasePost(postId, reason, auth.role);
      setPosts((list) => list.map((post) => String(post.id) === String(postId)
        ? { ...post, reported: true, reportReason: reason, updatedAt: new Date().toISOString() }
        : post));
      showToast('Post reported. Thank you.', 'success');
      return true;
    } catch (error) {
      showToast(error.message || 'Unable to submit the post report.', 'error');
      return false;
    }
  }, [auth.user, auth.role, setPosts, showToast, isSupabaseConfigured, reportSupabasePost]);

  const resolvePostReport = useCallback(async (post) => {
    if (auth.role !== 'admin') return false;
    const updatedAt = new Date().toISOString();
    try {
      if (isSupabaseConfigured) {
        await persistAdminPostModeration(post, { reported: false, reportReason: null });
      }
      setPosts((list) => list.map((item) => String(item.id) === String(post.id)
        ? { ...item, reported: false, reportReason: null, updatedAt }
        : item));
      showToast('Report resolved.', 'success');
      return true;
    } catch (error) {
      showToast(error.message || 'Unable to resolve the report.', 'error');
      return false;
    }
  }, [auth.role, setPosts, showToast, isSupabaseConfigured, persistAdminPostModeration]);

  return {
    addPost,
    toggleLikePost,
    addComment,
    deleteComment,
    deletePost,
    togglePinPost,
    toggleHidePost,
    reportPost,
    resolvePostReport,
  };
}
