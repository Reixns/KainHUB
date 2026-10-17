import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Flag, Pin, EyeOff, Trash2, Send, Shield, CheckCircle2, ImagePlus, X, MoreVertical, AlertTriangle, Megaphone, AlertCircle, Tag, Calendar, Truck as TruckIcon, Settings2, Share2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Textarea, Avatar, Modal, Badge, EmptyState, ConfirmDialog, getProductImage, isImageSource, timeAgo, formatPeso, MediaImage } from '@/components/UI';
import FavoriteButton from '@/components/FavoriteButton';

const POST_TYPES = {
  customer: [
    { id: 'post', label: 'Post', icon: <Megaphone className="w-4 h-4" /> },
  ],
  vendor: [
    { id: 'promotion', label: 'Promotion', icon: <Tag className="w-4 h-4" /> },
    { id: 'update', label: 'Update', icon: <AlertCircle className="w-4 h-4" /> },
    { id: 'new_product', label: 'New Product', icon: <Calendar className="w-4 h-4" /> },
  ],
  admin: [
    { id: 'announcement', label: 'Announcement', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'emergency', label: 'Emergency', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'promotion', label: 'Promotion', icon: <Tag className="w-4 h-4" /> },
    { id: 'event', label: 'Event', icon: <Calendar className="w-4 h-4" /> },
    { id: 'delivery', label: 'Delivery Notice', icon: <TruckIcon className="w-4 h-4" /> },
    { id: 'system', label: 'System', icon: <Settings2 className="w-4 h-4" /> },
  ],
};

export default function SharedMarketplace({ viewMode = 'feed' }) {
  const { auth, posts, addPost, postVendorMenu, uploadMediaFile, toggleLikePost, addComment, deleteComment, deletePost, togglePinPost, toggleHidePost, reportPost, showToast } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmShareMenu, setConfirmShareMenu] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [filter, setFilter] = useState('all');
  const [reportPostId, setReportPostId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const role = auth.role;
  const canCreate = !!auth.user;
  const currentTime = Date.now();

  const visiblePosts = posts
    .filter((p) => !p.hidden || role === 'admin')
    .filter((p) => !p.publishAt || new Date(p.publishAt).getTime() <= currentTime)
    .filter((p) => !p.expiresAt || new Date(p.expiresAt).getTime() > currentTime)
    .filter((p) => {
      if (viewMode === 'vendor' && role === 'vendor') {
        return true;
      }
      if (filter === 'all') return true;
      return p.authorRole === filter;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // Live counts so a filter chip never leads to an empty result.
  const filterCounts = useMemo(() => {
    const visible = posts.filter((p) => !p.hidden || role === 'admin');
    const counts = { all: visible.length, admin: 0, vendor: 0, customer: 0 };
    visible.forEach((p) => { if (counts[p.authorRole] !== undefined) counts[p.authorRole] += 1; });
    return counts;
  }, [posts, role]);

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Marketplace</h1>
          <p className="text-sm text-muted mt-1">Updates and announcements from your neighbourhood.</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            {role === 'vendor' && viewMode === 'vendor' && auth.user?.menu?.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setConfirmShareMenu(true)}>
                <Share2 className="w-4 h-4" /> Share full menu
              </Button>
            )}
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <ImagePlus className="w-4 h-4" />
              {role === 'admin' ? 'Create announcement' : viewMode === 'vendor' ? 'New post' : 'Create post'}
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'vendor' && role === 'vendor' ? null : (
        /*
         * Author filters. Solid dark pill for the active state rather than the
         * previous accent outline, so the selection is unambiguous against the
         * violet used for primary actions elsewhere in the app.
         */
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'admin', label: 'Official' },
            { id: 'vendor', label: 'Vendors' },
            { id: 'customer', label: 'Community' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-medium border transition-colors duration-150 ${
                filter === f.id
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-body border-hairline-strong hover:border-hairline-hover hover:text-ink'
              }`}
            >
              {f.label}
              <span className="text-[11px] font-semibold tabular-nums opacity-60">{filterCounts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer. Flat, matching the cards below it, so it reads as the first
          item in the feed rather than a separate hero element. */}
      {canCreate && viewMode !== 'vendor' && (
        <Card className="p-3 mb-5 flex items-center gap-3" onClick={() => setShowCreate(true)}>
          <Avatar
            name={auth.role === 'vendor' ? (auth.user?.name || auth.user?.fullName) : (auth.user?.fullName)}
            src={auth.role === 'vendor' && isImageSource(auth.user?.logo) ? auth.user.logo : undefined}
            size="sm"
          />
          <div className="flex-1 min-w-0 bg-surface-sunken border border-hairline rounded-control px-4 py-2.5 text-sm text-muted truncate">
            {role === 'admin' ? 'Share an official announcement...' : role === 'vendor' ? 'Post an update or promotion...' : "What's happening near you?"}
          </div>
          <ImagePlus className="w-5 h-5 text-subtle shrink-0" />
        </Card>
      )}

      {visiblePosts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description={viewMode === 'vendor' ? "You haven't posted anything yet. Create your first post!" : "Be the first to post in the marketplace!"}
        />
      ) : (
        <div className="space-y-5 max-w-2xl mx-auto">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              role={role}
              currentUserId={auth.user?.id}
              onLike={() => toggleLikePost(post.id)}
              onOpen={() => setSelectedPost(post)}
              onDelete={() => setConfirmDelete(post.id)}
              onPin={() => togglePinPost(post.id)}
              onHide={() => toggleHidePost(post.id)}
              onReport={() => setReportPostId(post.id)}
              vendorView={viewMode === 'vendor'}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          uploadMediaFile={uploadMediaFile}
          onSubmit={(data) => {
            addPost(data);
            setShowCreate(false);
          }}
          role={role}
        />
      )}

      {confirmShareMenu && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirmShareMenu(false)}
          onConfirm={() => {
            const result = postVendorMenu(auth.user.id);
            if (!result.success) showToast(result.message || 'Unable to share your menu right now.', 'error');
            setConfirmShareMenu(false);
          }}
          title="Share full menu?"
          message="Your full menu will be posted to the marketplace. You can share a menu once every hour."
          confirmText="Share full menu"
          variant="primary"
        />
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          role={role}
          currentUserId={auth.user?.id}
          onClose={() => setSelectedPost(null)}
          onLike={() => toggleLikePost(selectedPost.id)}
          onComment={(content) => addComment(selectedPost.id, content)}
          onDeleteComment={(cid) => deleteComment(selectedPost.id, cid)}
        />
      )}

      {reportPostId && (
        <Modal open={true} onClose={() => { setReportPostId(null); setReportReason(''); }} title="Report Post" size="sm" footer={
          <>
            <Button variant="ghost" onClick={() => { setReportPostId(null); setReportReason(''); }}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              if (reportReason) {
                reportPost(reportPostId, reportReason);
                setReportPostId(null);
                setReportReason('');
              }
            }}>Submit Report</Button>
          </>
        }>
          <p className="text-sm text-body mb-3">Why are you reporting this post?</p>
          <div className="space-y-2">
            {['Spam', 'Scam', 'Inappropriate', 'Fake Promotion', 'Offensive', 'Other'].map((r) => (
              <label key={r} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${reportReason === r ? 'border-brand bg-brand-soft' : 'border-hairline'}`}>
                <input type="radio" name="reason" value={r} checked={reportReason === r} onChange={() => setReportReason(r)} className="sr-only" />
                <span className="text-sm">{r}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { deletePost(confirmDelete); setConfirmDelete(null); if (selectedPost?.id === confirmDelete) setSelectedPost(null); }}
        title="Delete post?"
        message="This action cannot be undone."
        confirmText="Delete"
      />
    </div>
  );
}

function PostCard({ post, role, currentUserId, onLike, onOpen, onDelete, onPin, onHide, onReport, vendorView }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);

  // Escape from anywhere on the card closes the menu, not just from inside it,
  // and focus goes back to the trigger that opened it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuTriggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);
  const productImage = post.product && getProductImage(post.product.image);
  const isAuthor = currentUserId === post.authorId && (role === post.authorRole || (role === 'vendor' && post.authorId === currentUserId));
  const isAdmin = role === 'admin';
  const canModerate = isAdmin;
  const canDelete = isAuthor || canModerate;
  const canPin = isAdmin;
  const canHide = isAdmin;
  const liked = post.likedBy.includes(currentUserId);
  const authorImage = post.authorRole === 'vendor' && isImageSource(post.authorAvatar) ? post.authorAvatar : null;
  const profilePath = post.authorRole === 'vendor' || post.authorRole === 'customer'
    ? `/profiles/${post.authorRole}/${post.authorRole === 'vendor' ? (post.vendorId || post.authorId) : post.authorId}`
    : null;

  return (
    <Card className="overflow-hidden">
      {/*
        Three adjacent banners that each picked a different colour source:
        bg-brand-soft/text-brand-deep, bg-warning-soft/text-warning, and then
        bg-danger-soft paired with a raw text-red-700. That last one looked
        token-compliant in review while rendering a different hue from the two
        above it. All three now use the semantic soft-bg / text / border trio.
      */}
      {post.pinned && (
        <div className="flex items-center gap-1 border-b border-info/25 bg-info-soft px-4 py-1.5 text-xs font-medium text-info">
          <Pin className="w-3 h-3" aria-hidden="true" /> Pinned Post
        </div>
      )}
      {post.hidden && (
        <div className="flex items-center gap-1 border-b border-warning/25 bg-warning-soft px-4 py-1.5 text-xs font-medium text-warning">
          <EyeOff className="w-3 h-3" aria-hidden="true" /> Hidden (only admins can see this)
        </div>
      )}
      {post.reported && (
        <div className="flex items-center gap-1 border-b border-danger/25 bg-danger-soft px-4 py-1.5 text-xs font-medium text-danger">
          <Flag className="w-3 h-3" aria-hidden="true" /> Reported: {post.reportReason}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {profilePath ? (
            <Link to={profilePath} className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-lg shrink-0 hover:ring-2 hover:ring-brand-300" aria-label={`View ${post.authorName} profile`}>
              {authorImage ? <img src={authorImage} alt={post.authorName} className="w-full h-full rounded-full object-cover" /> : (post.authorName ? post.authorName.slice(0, 1).toUpperCase() : '?')}
            </Link>
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-lg shrink-0">
              {authorImage ? <img src={authorImage} alt={post.authorName} className="w-full h-full rounded-full object-cover" /> : (post.authorName ? post.authorName.slice(0, 1).toUpperCase() : '?')}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {profilePath ? (
                <Link to={profilePath} className="font-semibold text-ink text-sm hover:text-brand-strong">{post.authorName}</Link>
              ) : (
                <span className="font-semibold text-ink text-sm">{post.authorName}</span>
              )}
              {post.verified && post.authorRole === 'vendor' && (
                <span className="inline-flex items-center gap-0.5 bg-success-soft text-success text-[11px] font-medium px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED VENDOR
                </span>
              )}
              {post.authorRole === 'admin' && (
                <span className="inline-flex items-center gap-0.5 bg-cat-blue/10 text-brand-deep text-[11px] font-medium px-1.5 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" /> OFFICIAL ADMIN
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
              <span>{timeAgo(post.createdAt)}</span>
              {post.type && <span className="px-1.5 py-0.5 bg-surface-hover rounded text-[11px] capitalize">{post.type.replace('_', ' ')}</span>}
            </div>
          </div>
          <div className="relative">
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Post actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="tap-target hover:bg-surface-hover rounded-full"
            >
              <MoreVertical className="w-4 h-4 text-muted" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
                {/*
                  Menu pattern: Escape closes, focus returns to the trigger, and
                  the open state drives aria-expanded. Without these the menu was
                  pointer-only -- a keyboard user could open it and then had no
                  way out.
                */}
                <div
                  role="menu"
                  aria-label="Post actions"
                  className="absolute right-0 top-full mt-1 bg-white rounded-control shadow-float border border-hairline py-1 w-44 z-20"
                >
                  {canPin && (
                    <button type="button" role="menuitem" onClick={() => { onPin(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken flex items-center gap-2">
                      <Pin className="w-4 h-4" /> {post.pinned ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                  {canHide && (
                    <button type="button" role="menuitem" onClick={() => { onHide(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken flex items-center gap-2">
                      <EyeOff className="w-4 h-4" /> {post.hidden ? 'Unhide' : 'Hide'}
                    </button>
                  )}
                  {!isAuthor && !isAdmin && (
                    <button type="button" role="menuitem" onClick={() => { onReport(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger-soft flex items-center gap-2">
                      <Flag className="w-4 h-4" /> Report
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" role="menuitem" onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger-soft flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-sm text-ink mt-3 whitespace-pre-wrap">{post.content}</p>

        {post.product && (
          <div className="mt-3 overflow-hidden rounded-card border border-hairline bg-surface-sunken">
            <div className="relative aspect-[3/2] bg-surface-hover">
              {productImage ? (
                <MediaImage
                  src={productImage}
                  alt={post.product.name}
                  className="w-full h-full object-cover"
                  fallback={<div className="w-full h-full flex items-center justify-center text-3xl" aria-hidden="true">🍽️</div>}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl" aria-hidden="true">🍽️</div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{post.product.name}</div>
                  <div className="text-xs text-muted mt-0.5 capitalize">{post.product.category || 'Menu item'}</div>
                </div>
                <div className="text-base font-bold text-ink shrink-0 tabular-nums">{formatPeso(post.product.price)}</div>
              </div>
              {post.product.description && (
                <p className="text-sm text-body mt-1.5">{post.product.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                <Badge color={post.product.available && post.product.stock > 0 ? 'green' : 'red'}>
                  {post.product.available && post.product.stock > 0 ? 'Available' : 'Out of stock'}
                </Badge>
                <span className="text-xs text-muted tabular-nums">{post.product.stock || 0} in stock</span>
              </div>
              <Link
                to={`/customer/shops/${post.vendorId || post.authorId}`}
                className="mt-3 flex items-center justify-center rounded-control bg-brand px-3 py-2 min-h-11 text-sm font-semibold text-white hover:bg-brand-strong"
              >
                View menu
              </Link>
            </div>
          </div>
        )}

        {post.products && (
          <div className="mt-3 rounded-card border border-hairline bg-surface-sunken p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-semibold text-ink">Menu</div>
              <Link to={`/customer/shops/${post.vendorId || post.authorId}`} className="text-sm font-medium text-brand-strong hover:text-brand-deep">
                View all
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {post.products.map((product) => {
                const image = getProductImage(product.image);
                return (
                  <div key={product.id} className="overflow-hidden rounded-card border border-hairline bg-white">
                    <div className="relative aspect-[3/2] bg-surface-hover">
                      {image ? (
                        <MediaImage
                          src={image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          fallback={<DishFallback product={product} />}
                        />
                      ) : (
                        <DishFallback product={product} />
                      )}
                      {/* A dish can be saved from the feed without opening the
                          shop. The shop is carried along so the favourites list
                          can say where the dish was read from. */}
                      <span className="absolute top-2 left-2">
                        <FavoriteButton
                          type="product"
                          refId={product.id}
                          vendorId={post.vendorId || post.authorId}
                          label={product.name}
                        />
                      </span>
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-ink text-sm">{product.name}</div>
                        <div className="text-sm font-bold text-ink shrink-0 tabular-nums">{formatPeso(product.price)}</div>
                      </div>
                      <div className="text-xs text-muted capitalize mt-0.5">{product.category || 'Menu item'}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge color={product.available && product.stock > 0 ? 'green' : 'red'}>
                          {product.available && product.stock > 0 ? 'Available' : 'Out of stock'}
                        </Badge>
                        <span className="text-xs text-muted tabular-nums">{product.stock || 0} in stock</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {post.image && (
        <button type="button" onClick={onOpen} className="block w-full bg-surface-hover border-y border-hairline" aria-label="Open image">
          <MediaImage
            src={post.image}
            alt=""
            className="w-full max-h-96 object-cover"
            fallback={<PostImageFallback text={post.content} />}
          />
        </button>
      )}
      {/* Action bar. Counts sit as plain metadata beside their icon rather than
          inside a pill, which kept the bar visually noisy at this size. */}
      <div className="px-3 py-1.5 border-t border-hairline flex items-center gap-0.5">
        <ActionButton onClick={onLike} active={liked} activeClass="text-danger">
          <Heart className={`w-4 h-4 ${liked ? 'fill-danger' : ''}`} aria-hidden="true" />
          <span className="text-sm tabular-nums">{post.likes}</span>
          <span className="sr-only">likes</span>
        </ActionButton>
        <ActionButton onClick={onOpen}>
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm tabular-nums">{post.comments.length}</span>
          <span className="sr-only">comments</span>
        </ActionButton>
        {/*
          Share and Save are gone, and the `ml-auto` that pinned Share to the
          right edge went with them.

          Share was an ActionButton with no onClick, so it was a dead control:
          it rendered like the two buttons beside it and did nothing when
          pressed. Save was honest about it -- `disabled` with a title saying
          bookmarking is not implemented -- but a permanently greyed bookmark is
          still a promise of a feature that does not exist, and it took the full
          40px tap target to say so. Neither had anywhere to go, so the bar is
          left with the two actions that work.
        */}
      </div>

      {post.comments.length > 0 && !vendorView && (
        <div className="px-4 pb-3">
          <button type="button" onClick={onOpen} className="text-sm text-muted hover:text-ink">
            View {post.comments.length} comment{post.comments.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </Card>
  );
}

/*
  The dish tile's placeholder, used both when a product has no image at all and
  when the one it has cannot be loaded. Naming it meant the two cases could not
  drift: the no-image branch fell back to the emoji while the failed-load branch
  left the box empty, so the same product looked like it had a photo in one list
  and no photo in the other.
*/
function DishFallback({ product }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-2xl" aria-hidden="true">
      {product.image && product.image.length <= 4 ? product.image : '🍽️'}
    </div>
  );
}

/*
  A post's attached photo that will not load.

  Shows the opening words of the post instead of an empty band. A post image
  spans the full width, so the old `display:none` handler left a bare
  `bg-surface-hover` stripe above the text -- a visibly broken attachment on a post
  that otherwise read fine. The post's own words are always available, so they
  are the honest thing to show.
*/
function PostImageFallback({ text }) {
  const words = String(text || '').trim().split(/\s+/).slice(0, 12).join(' ');
  return (
    <div className="w-full rounded-lg bg-surface-hover px-4 py-6 text-center" aria-hidden="true">
      <div className="text-sm text-subtle line-clamp-3">{words || 'Image unavailable'}</div>
    </div>
  );
}

function ActionButton({ children, onClick, active, activeClass = '', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 px-2.5 rounded-control inline-flex items-center gap-1.5 transition-colors duration-150 ${
        active ? activeClass : 'text-body hover:bg-surface-hover hover:text-ink'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function CreatePostModal({ onClose, onSubmit, uploadMediaFile, role }) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState(
    role === 'admin' ? 'announcement' : role === 'vendor' ? 'promotion' : 'post'
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const types = POST_TYPES[role] || POST_TYPES.customer;

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      setError('');
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setError('');
    let image = null;
    if (imageFile) {
      const result = await uploadMediaFile(imageFile, 'posts');
      if (!result.success) {
        setError(result.message);
        setSaving(false);
        return;
      }
      image = result.url;
    }
    onSubmit({ content: content.trim(), image, type: postType, pinned });
    setSaving(false);
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={role === 'admin' ? 'Create Official Announcement' : role === 'vendor' ? 'Create Vendor Post' : 'Create Post'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!content.trim()} loading={saving}>
            {role === 'admin' ? 'Post announcement' : 'Post'}
          </Button>
        </>
      }
    >
      {types.length > 1 && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-body mb-2">Post Type</label>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button type="button"
                key={t.id}
                onClick={() => setPostType(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  postType === t.id ? 'bg-brand text-white border-brand' : 'bg-white text-body border-hairline'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Textarea
        placeholder={
          role === 'admin' ? "Write an official announcement..." :
          role === 'vendor' ? "Share an update, promo, or announcement..." :
          "What's on your mind?"
        }
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
      />

      {imagePreview && (
        <div className="relative mt-3">
          <img src={imagePreview} alt="Selected post" className="w-full rounded-lg max-h-[30vh] object-cover" />
          <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-hairline hover:bg-surface-sunken text-sm text-body">
            <ImagePlus className="w-4 h-4" /> Add Photo
          </span>
        </label>
        {role === 'admin' && (
          <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin post
          </label>
        )}
      </div>
    </Modal>
  );
}

function PostDetailModal({ post, role, currentUserId, onClose, onLike, onComment, onDeleteComment }) {
  const [commentText, setCommentText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(commentText);
      setCommentText('');
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="" size="lg">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-lg">
          {post.authorRole === 'vendor' && isImageSource(post.authorAvatar) ? <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full rounded-full object-cover" /> : (post.authorName ? post.authorName.slice(0, 1).toUpperCase() : '?')}
        </div>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-ink text-sm">{post.authorName}</span>
            {post.verified && post.authorRole === 'vendor' && <Badge color="green">VERIFIED VENDOR</Badge>}
            {post.authorRole === 'admin' && <Badge color="blue">OFFICIAL ADMIN</Badge>}
          </div>
          <div className="text-xs text-muted">{timeAgo(post.createdAt)}</div>
        </div>
      </div>
      <p className="text-sm text-ink whitespace-pre-wrap mb-3">{post.content}</p>
      {/* No `{post.image && ...}` guard here: MediaImage renders `fallback` for
          an empty src too, which is the same result and one less branch. */}
      <MediaImage
        src={post.image}
        alt=""
        className="w-full rounded-lg mb-3 max-h-96 object-cover"
        fallback={<PostImageFallback text={post.content} />}
      />

      <div className="border-t pt-3 mb-3">
        <div className="flex items-center gap-1 text-sm">
          <button type="button" onClick={onLike} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${post.likedBy.includes(currentUserId) ? 'text-danger' : 'text-body hover:bg-surface-hover'}`}>
            <Heart className={`w-4 h-4 ${post.likedBy.includes(currentUserId) ? 'fill-danger' : ''}`} /> {post.likes}
          </button>
        </div>
      </div>

      <div className="border-t pt-3 space-y-3 max-h-64 overflow-y-auto">
        <h4 className="text-xs font-semibold text-muted uppercase">{post.comments.length} Comments</h4>
        {post.comments.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No comments yet. Be the first to comment!</p>
        ) : (
          post.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-sm shrink-0 overflow-hidden">{c.authorRole === 'vendor' && isImageSource(c.authorAvatar) ? <img src={c.authorAvatar} alt={c.authorName} className="w-full h-full object-cover" /> : (c.authorName ? c.authorName.slice(0, 1).toUpperCase() : '?')}</div>
              <div className="flex-1 bg-white rounded-control px-3 py-2 border border-hairline">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-ink text-xs">{c.authorName}</span>
                  {c.authorRole === 'vendor' && <Badge color="green">Vendor</Badge>}
                  {c.authorRole === 'admin' && <Badge color="blue">Admin</Badge>}
                </div>
                <p className="text-sm text-ink">{c.content}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  <span>{timeAgo(c.createdAt || c.time)}</span>
                  {((c.authorId && String(c.authorId) === String(currentUserId)) || role === 'admin') && (
                    <button type="button" onClick={() => onDeleteComment(c.id)} className="text-danger hover:underline">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2 border-t pt-3">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 px-3 py-2 border border-hairline rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-line focus:border-brand-400"
        />
        <button type="submit" aria-label="Post comment" disabled={!commentText.trim()} className="w-11 h-11 bg-brand text-white rounded-full flex items-center justify-center disabled:opacity-50 shrink-0">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </Modal>
  );
}

// Deleted: the shared isImageSource at the top of this file supersedes it.
