import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import type { ContentItem, ContentStats, ContentStatus, ContentPlatform, Pagination } from '../../types/admin';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<ContentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  TWITTER: 'Twitter/X',
  LINKEDIN: 'LinkedIn',
  BLOG: 'Blog',
};

const PLATFORM_COLORS: Record<ContentPlatform, string> = {
  TWITTER: 'bg-sky-100 text-sky-700',
  LINKEDIN: 'bg-indigo-100 text-indigo-700',
  BLOG: 'bg-emerald-100 text-emerald-700',
};

const REJECTION_CHIPS = [
  'Off-brand tone',
  'Topic not relevant',
  'Too generic',
  'Factually inaccurate',
  'Already covered',
  'Poor quality',
];

export default function ContentManager() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hideRejected, setHideRejected] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, statsRes] = await Promise.all([
        api.getContentItems({
          page,
          status: statusFilter || undefined,
          platform: platformFilter || undefined,
          search: search || undefined,
          excludeStatus: (!statusFilter && hideRejected) ? 'REJECTED' : undefined,
        }),
        api.getContentStats(),
      ]);
      setItems(itemsRes.items);
      setPagination(itemsRes.pagination);
      setStats(statsRes);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, platformFilter, search, hideRejected]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const checkLinkedInAdvisory = (item: ContentItem) => {
    if (item.platform !== 'LINKEDIN') return;
    const siblingBlog = items.find(
      (i) => i.platform === 'BLOG' && item.sourceTitle && i.sourceTitle === item.sourceTitle && i.status !== 'PUBLISHED'
    );
    if (siblingBlog) {
      toast('This LinkedIn post links to your blog. Make sure the blog post is also published.', { icon: '\u26A0\uFE0F', duration: 6000 });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const updated = await api.approveContent(id);
      toast.success('Content approved');
      checkLinkedInAdvisory(updated);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedItem?.id === id) setSelectedItem(updated);
      fetchItems();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReject = (id: string) => {
    setRejectingId(id);
  };

  const handleRejectConfirm = async (id: string, reason: string) => {
    try {
      const updated = await api.rejectContent(id, reason);
      toast.success('Content rejected');
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedItem?.id === id) setSelectedItem(updated);
      setRejectingId(null);
      fetchItems();
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePublish = async (id: string) => {
    try {
      const item = items.find((i) => i.id === id);
      const updated = await api.publishContent(id);
      if (updated.publishError) {
        toast.error(`Publish failed: ${updated.publishError}`);
      } else if (updated.manualInstructions) {
        toast.success('Published with manual instructions');
      } else {
        toast.success('Published successfully!');
      }
      if (item) checkLinkedInAdvisory(item);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedItem?.id === id) setSelectedItem(updated);
      fetchItems();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCrosspost = async (id: string, platform: 'devto' | 'hashnode', includeCoverImage?: boolean) => {
    try {
      const result = await api.crosspostContent(id, [platform], undefined, undefined, includeCoverImage);
      const platResult = result.crosspostResults?.[platform === 'devto' ? 'devto' : 'hashnode'];
      if (platResult?.success) {
        toast.success(`Cross-posted to ${platform === 'devto' ? 'Dev.to' : 'Hashnode'}!`);
      } else if (platResult?.manualInstructions) {
        toast.success('Manual instructions generated');
      } else if (platResult?.skipped) {
        toast('Already cross-posted', { icon: '\u2139\uFE0F' });
      } else {
        toast.error(`Cross-post failed: ${platResult?.error || 'Unknown error'}`);
      }
      // Refresh the item to get updated URLs
      const updated = await api.getContentItem(id);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedItem?.id === id) setSelectedItem(updated);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this content item?')) return;
    try {
      await api.deleteContent(id);
      toast.success('Deleted');
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      fetchItems();
    } catch (e: any) { toast.error(e.message); }
  };

  function getContentPreview(item: ContentItem): string {
    if (item.platform === 'TWITTER') return item.tweetDraft || '';
    if (item.platform === 'LINKEDIN') return item.linkedinSnippet || '';
    if (item.platform === 'BLOG') return item.blogExcerpt || item.blogTitle || '';
    return '';
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Content Manager</h2>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED'] as ContentStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1); }}
              className={`px-4 py-3 rounded-lg text-center transition-all ${statusFilter === s ? 'ring-2 ring-blue-500' : ''} ${STATUS_COLORS[s]}`}
            >
              <div className="text-2xl font-bold">{stats.byStatus[s] || 0}</div>
              <div className="text-xs font-medium">{s}</div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-md"
        >
          <option value="">All Platforms</option>
          <option value="TWITTER">Twitter/X</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="BLOG">Blog</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search..."
          className="px-3 py-2 text-sm border border-gray-200 rounded-md flex-1"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideRejected}
            onChange={(e) => { setHideRejected(e.target.checked); setPage(1); }}
            className="rounded border-gray-300"
          />
          Hide rejected
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Platform</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Content Preview</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Score</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No content items found</td></tr>
            ) : items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[item.platform]}`}>
                    {PLATFORM_LABELS[item.platform]}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  {item.sourceTitle || item.blogTitle || 'Original post'}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[300px] truncate">
                  {getContentPreview(item)}
                </td>
                <td className="px-4 py-3 text-gray-600">{item.relevanceScore ?? '-'}/3</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {item.status === 'DRAFT' && (
                      <button onClick={() => handleApprove(item.id)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Approve</button>
                    )}
                    {item.status === 'APPROVED' && (
                      <button onClick={() => handlePublish(item.id)} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Publish</button>
                    )}
                    {['DRAFT', 'REVIEW'].includes(item.status) && (
                      <button onClick={() => handleReject(item.id)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">Reject</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingId && (
        <RejectionReasonModal
          onConfirm={(reason) => handleRejectConfirm(rejectingId, reason)}
          onCancel={() => setRejectingId(null)}
        />
      )}

      {/* Detail Panel (Modal) */}
      {selectedItem && (
        <ContentDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onPublish={handlePublish}
          onDelete={handleDelete}
          onUpdate={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setSelectedItem(updated);
          }}
          onCrosspost={handleCrosspost}
        />
      )}
    </div>
  );
}

function ContentDetailModal({
  item,
  onClose,
  onApprove,
  onReject,
  onPublish,
  onDelete,
  onUpdate,
  onCrosspost,
}: {
  item: ContentItem;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (item: ContentItem) => void;
  onCrosspost: (id: string, platform: 'devto' | 'hashnode', includeCoverImage?: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [includeCoverImage, setIncludeCoverImage] = useState(!!item.blogImageR2Key);

  useEffect(() => {
    if (item.platform === 'TWITTER') setDraft(item.tweetDraft || '');
    else if (item.platform === 'LINKEDIN') setDraft(item.linkedinSnippet || '');
    else if (item.platform === 'BLOG') setDraft(item.blogBody || '');
  }, [item]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: any = {};
      if (item.platform === 'TWITTER') data.tweetDraft = draft;
      else if (item.platform === 'LINKEDIN') data.linkedinSnippet = draft;
      else if (item.platform === 'BLOG') data.blogBody = draft;

      const updated = await api.updateContentItem(item.id, data);
      onUpdate(updated);
      setEditing(false);
      toast.success('Saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status]}`}>
              {item.status}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[item.platform]}`}>
              {PLATFORM_LABELS[item.platform]}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Source info */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">{item.sourceTitle || 'Original post'}</h3>
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                {item.sourceUrl}
              </a>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Source: {item.source || 'N/A'} | Score: {item.relevanceScore ?? '-'}/3
            </div>
            {item.whyUs && (
              <p className="text-sm text-gray-600 mt-2 italic">{item.whyUs}</p>
            )}
          </div>

          {/* Featured toggle (BLOG items only) */}
          {item.platform === 'BLOG' && (
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={item.isFeatured}
                  onChange={async () => {
                    try {
                      const updated = await api.updateContentItem(item.id, { isFeatured: !item.isFeatured });
                      onUpdate(updated);
                      toast.success(updated.isFeatured ? 'Marked as featured' : 'Removed from featured');
                    } catch (e: any) { toast.error(e.message); }
                  }}
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </label>
              <span className="text-sm text-gray-700">Featured on blog</span>
            </div>
          )}

          {/* Blog Cover Image (BLOG items, APPROVED/PUBLISHED only) */}
          {item.platform === 'BLOG' && ['APPROVED', 'PUBLISHED'].includes(item.status) && (
            <BlogCoverImageSection item={item} onUpdate={onUpdate} />
          )}

          {/* Content editor */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-gray-700">
                {item.platform === 'TWITTER' && 'Tweet Draft'}
                {item.platform === 'LINKEDIN' && 'LinkedIn Snippet'}
                {item.platform === 'BLOG' && 'Blog Article'}
              </h4>
              <div className="flex gap-2">
                {item.platform === 'BLOG' && (
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    {showPreview ? 'Edit' : 'Preview'}
                  </button>
                )}
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">
                    Edit
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={saving} className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>

            {item.platform === 'TWITTER' && (
              <div>
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-md resize-none"
                    maxLength={280}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-md p-3 text-sm">{item.tweetDraft}</div>
                )}
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {(editing ? draft : item.tweetDraft || '').length}/280
                </div>
              </div>
            )}

            {item.platform === 'LINKEDIN' && (
              <div>
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full h-32 px-3 py-2 text-sm border border-gray-200 rounded-md resize-none"
                  />
                ) : (
                  <div className="bg-gray-50 rounded-md p-3 text-sm whitespace-pre-wrap">{item.linkedinSnippet}</div>
                )}
              </div>
            )}

            {item.platform === 'BLOG' && (
              <div>
                {item.blogTitle && (
                  <div className="text-sm mb-2">
                    <span className="font-medium">Title:</span> {item.blogTitle}
                  </div>
                )}
                {item.blogSlug && (
                  <div className="text-xs text-gray-500 mb-2">
                    Slug: /blog/{item.blogSlug} | {item.blogReadingTime || 'N/A'}
                  </div>
                )}
                {showPreview ? (
                  <div
                    className="prose prose-sm max-w-none bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdown(editing ? draft : item.blogBody || '') }}
                  />
                ) : editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full h-64 px-3 py-2 text-sm border border-gray-200 rounded-md font-mono resize-y"
                  />
                ) : (
                  <div className="bg-gray-50 rounded-md p-3 text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {item.blogBody}
                  </div>
                )}
                {item.blogExcerpt && (
                  <div className="text-xs text-gray-500 mt-2">
                    <span className="font-medium">Excerpt:</span> {item.blogExcerpt}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Published info */}
          {item.publishedUrl && (
            <div className="bg-green-50 rounded-md p-3">
              <div className="text-sm font-medium text-green-700">Published</div>
              <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline break-all">
                {item.publishedUrl}
              </a>
            </div>
          )}

          {/* Cross-post status (BLOG items only) */}
          {item.platform === 'BLOG' && item.status === 'PUBLISHED' && (
            <div className="bg-gray-50 rounded-md p-3 space-y-2">
              <div className="text-sm font-medium text-gray-700">Cross-posts</div>

              {/* Include cover image toggle */}
              {item.blogImageR2Key && (!item.devtoUrl || !item.hashnodeUrl) && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCoverImage}
                    onChange={(e) => setIncludeCoverImage(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Include cover image
                </label>
              )}

              {/* Dev.to */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Dev.to</span>
                {item.devtoUrl ? (
                  <a href={item.devtoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline flex items-center gap-1">
                    <span>&#10003;</span> Published
                  </a>
                ) : item.crosspostErrors?.devto ? (
                  <span className="text-sm text-red-500" title={item.crosspostErrors.devto}>Failed</span>
                ) : (
                  <button
                    onClick={() => onCrosspost(item.id, 'devto', includeCoverImage)}
                    className="text-xs px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-900"
                  >
                    Cross-post to Dev.to
                  </button>
                )}
              </div>

              {/* Hashnode */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Hashnode</span>
                {item.hashnodeUrl ? (
                  <a href={item.hashnodeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline flex items-center gap-1">
                    <span>&#10003;</span> Published
                  </a>
                ) : item.crosspostErrors?.hashnode ? (
                  <span className="text-sm text-red-500" title={item.crosspostErrors.hashnode}>Failed</span>
                ) : (
                  <button
                    onClick={() => onCrosspost(item.id, 'hashnode', includeCoverImage)}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Cross-post to Hashnode
                  </button>
                )}
              </div>
            </div>
          )}

          {item.publishError && (
            <div className="bg-red-50 rounded-md p-3">
              <div className="text-sm font-medium text-red-700">Publish Error</div>
              <div className="text-sm text-red-600">{item.publishError}</div>
            </div>
          )}

          {/* Rejection info */}
          {item.status === 'REJECTED' && item.rejectionReason && (
            <div className="bg-red-50 rounded-md p-3">
              <div className="text-sm font-medium text-red-700">Rejection Reason</div>
              <div className="text-sm text-red-600 mt-1">{item.rejectionReason}</div>
              {item.rejectedAt && (
                <div className="text-xs text-red-400 mt-1">
                  Rejected {new Date(item.rejectedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Manual instructions */}
          {item.manualInstructions && (
            <div className="bg-amber-50 rounded-md p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium text-amber-700">Manual Instructions</div>
                <button
                  onClick={() => handleCopy(item.manualInstructions!)}
                  className="text-xs px-2 py-1 bg-amber-200 text-amber-800 rounded hover:bg-amber-300"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="text-sm text-amber-800 whitespace-pre-wrap font-mono">{item.manualInstructions}</pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            {item.status === 'DRAFT' && (
              <>
                <button onClick={() => onApprove(item.id)} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  Approve
                </button>
                <button onClick={() => onReject(item.id)} className="px-4 py-2 text-sm bg-red-100 text-red-600 rounded-md hover:bg-red-200">
                  Reject
                </button>
              </>
            )}
            {item.status === 'REVIEW' && (
              <>
                <button onClick={() => onApprove(item.id)} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  Approve
                </button>
                <button onClick={() => onReject(item.id)} className="px-4 py-2 text-sm bg-red-100 text-red-600 rounded-md hover:bg-red-200">
                  Reject
                </button>
              </>
            )}
            {item.status === 'APPROVED' && (
              <button onClick={() => onPublish(item.id)} className="px-4 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600">
                Publish
              </button>
            )}
            <button onClick={() => onDelete(item.id)} className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 ml-auto">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlogCoverImageSection({
  item,
  onUpdate,
}: {
  item: ContentItem;
  onUpdate: (item: ContentItem) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(item.blogImageType || null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Fetch presigned URLs on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const urls = await api.getBlogImageUrls(item.id);
        if (!cancelled) {
          setImageUrl(urls.imageUrl);
          setImageType(urls.imageType);
        }
      } catch {
        // no image yet
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item.id, item.blogImageType]);

  const handleGenerate = async (type: 'template' | 'pixel' | 'generated') => {
    setLoading(true);
    try {
      const result = await api.generateBlogImage(item.id, type);
      setImageUrl(result.imageUrl);
      setImageType(type);
      onUpdate(result);
      toast.success(`${type === 'generated' ? 'AI' : type.charAt(0).toUpperCase() + type.slice(1)} cover image generated`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  const IMAGE_TYPES = [
    { key: 'template' as const, label: 'Template' },
    { key: 'pixel' as const, label: 'Pixel Art' },
    { key: 'generated' as const, label: 'AI Generated' },
  ];

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-gray-700">Cover Image</h4>
        {imageType === 'generated' && imageUrl && (
          <button
            onClick={() => handleGenerate('generated')}
            disabled={loading}
            className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-white disabled:opacity-50"
          >
            Regenerate
          </button>
        )}
      </div>

      {/* Type selector buttons */}
      <div className="flex gap-2 mb-3">
        {IMAGE_TYPES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleGenerate(key)}
            disabled={loading}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50 ${
              imageType === key
                ? 'bg-blue-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {(loading || fetching) && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {loading ? 'Generating...' : 'Loading...'}
        </div>
      )}

      {/* Image preview */}
      {!loading && !fetching && imageUrl && (
        <div>
          <div className="rounded-md overflow-hidden border border-gray-200 mb-2" style={{ aspectRatio: '1200/630' }}>
            <img src={imageUrl} alt="Blog cover" className="w-full h-full object-cover" />
          </div>
          <a
            href={imageUrl}
            download={`${item.blogSlug || item.id}-cover.webp`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Download Full Size
          </a>
        </div>
      )}

      {/* No image yet */}
      {!loading && !fetching && !imageUrl && (
        <div className="text-sm text-gray-500 py-4 text-center">
          No cover image yet. Click a style above to generate one.
        </div>
      )}
    </div>
  );
}

function RejectionReasonModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Content</h3>

        <div className="flex flex-wrap gap-2 mb-3">
          {REJECTION_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setReason((prev) => prev ? `${prev}. ${chip}` : chip)}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this being rejected?"
          className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-md resize-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
          autoFocus
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple markdown to HTML for preview (handles headers, bold, links, lists)
function simpleMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>');
}
