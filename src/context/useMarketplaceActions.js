import { useCallback } from 'react';
import { nextLocalId } from './persistence';

export function useMarketplaceActions({ setPosts, auth, showToast }) {
  const addPost = useCallback((post) => {
    const newPost = {
      // Was `Date.now() + Math.random()`. posts.legacy_id is `bigint`, and a
      // fractional value is rejected by Postgres on write (and round-trips
      // back as a different number, so the row could not be matched again).
      id: nextLocalId(),
      authorId: auth.user.id,
      authorRole: auth.role,
      authorName: auth.role === 'vendor' ? auth.user.name : auth.user.fullName,
      authorAvatar: auth.role === 'vendor' ? auth.user.logo : 'dY',
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
    setPosts((p) => [newPost, ...p]);
    showToast('Post published!', 'success');
    return newPost;
  }, [setPosts, auth, showToast]);

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

  const addComment = useCallback((postId, content) => {
    if (!auth.user || !content.trim()) return;
    const name = auth.role === 'vendor' ? auth.user.name : auth.user.fullName;
    const avatar = auth.role === 'vendor' ? auth.user.logo : 'dY';
    setPosts((list) => list.map((p) => {
      if (p.id !== postId) return p;
      const newComment = {
        id: nextLocalId(),
        authorId: auth.user.id,
        authorName: name,
        authorAvatar: avatar,
        authorRole: auth.role,
        content: content.trim(),
        time: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      return { ...p, comments: [...p.comments, newComment] };
    }));
  }, [setPosts, auth]);

  const deleteComment = useCallback((postId, commentId) => {
    if (!auth.user) return;
    setPosts((list) => list.map((p) => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: p.comments.filter((c) => c.id !== commentId || (auth.role !== 'admin' && String(c.authorId) !== String(auth.user.id))),
      };
    }));
  }, [setPosts, auth]);

  const deletePost = useCallback((postId) => {
    setPosts((list) => list.filter((p) => p.id !== postId));
    showToast('Post deleted.', 'success');
  }, [setPosts, showToast]);

  const togglePinPost = useCallback((postId) => {
    setPosts((list) => list.map((p) => p.id === postId ? { ...p, pinned: !p.pinned } : p));
  }, [setPosts]);

  const toggleHidePost = useCallback((postId) => {
    setPosts((list) => list.map((p) => p.id === postId ? { ...p, hidden: !p.hidden } : p));
  }, [setPosts]);

  const reportPost = useCallback((postId, reason) => {
    setPosts((list) => list.map((p) => p.id === postId ? { ...p, reported: true, reportReason: reason } : p));
    showToast('Post reported. Thank you.', 'success');
  }, [setPosts, showToast]);

  return {
    addPost,
    toggleLikePost,
    addComment,
    deleteComment,
    deletePost,
    togglePinPost,
    toggleHidePost,
    reportPost,
  };
}
