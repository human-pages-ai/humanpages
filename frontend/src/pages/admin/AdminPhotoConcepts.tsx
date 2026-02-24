import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { PhotoConcept } from '../../types/admin';

type ModalMode = 'create' | 'edit' | 'view' | null;

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-gray-100 text-gray-700' },
  approved: { label: 'Approved', cls: 'bg-blue-100 text-blue-700' },
  rendered: { label: 'Rendered', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function formatPlatforms(platforms: string[]): string {
  if (!platforms || platforms.length === 0) return '—';
  return platforms.join(', ');
}

export default function AdminPhotoConcepts() {
  const [concepts, setConcepts] = useState<PhotoConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<PhotoConcept | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    postType: 'carousel',
    targetPlatforms: [] as string[],
    concept: '',
    tone: '',
    imagePrompt: '',
    imageStyle: '',
    captionText: '',
    bodyText: '',
    topText: '',
    bottomText: '',
    statValue: '',
    statLabel: '',
    quoteText: '',
    quoteAttribution: '',
    jobTitle: '',
    jobDescription: '',
    jobBudget: '',
    pillar: '',
    hashtags: [] as string[],
    fontStyle: '',
    accentColor: '',
    needsImage: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Approve modal
  const [approveSlug, setApproveSlug] = useState<string | null>(null);

  // Render modal
  const [renderSlug, setRenderSlug] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // Batch generate
  const [batchGenerating, setBatchGenerating] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchConcepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPhotoConcepts();
      setConcepts(res.concepts);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  const openCreate = () => {
    setFormData({
      title: '',
      slug: '',
      postType: 'carousel',
      targetPlatforms: [],
      concept: '',
      tone: '',
      imagePrompt: '',
      imageStyle: '',
      captionText: '',
      bodyText: '',
      topText: '',
      bottomText: '',
      statValue: '',
      statLabel: '',
      quoteText: '',
      quoteAttribution: '',
      jobTitle: '',
      jobDescription: '',
      jobBudget: '',
      pillar: '',
      hashtags: [],
      fontStyle: '',
      accentColor: '',
      needsImage: false,
    });
    setAutoSlug(true);
    setSaveError('');
    setModalMode('create');
  };

  const openEdit = async (concept: PhotoConcept) => {
    try {
      const full = await api.getPhotoConcept(concept.slug);
      setSelected(full);
      setFormData({
        title: full.title,
        slug: full.slug,
        postType: full.postType,
        targetPlatforms: full.targetPlatforms || [],
        concept: full.concept,
        tone: full.tone,
        imagePrompt: full.imagePrompt || '',
        imageStyle: full.imageStyle || '',
        captionText: full.captionText || '',
        bodyText: full.bodyText || '',
        topText: full.topText || '',
        bottomText: full.bottomText || '',
        statValue: full.statValue || '',
        statLabel: full.statLabel || '',
        quoteText: full.quoteText || '',
        quoteAttribution: full.quoteAttribution || '',
        jobTitle: full.jobTitle || '',
        jobDescription: full.jobDescription || '',
        jobBudget: full.jobBudget || '',
        pillar: full.pillar || '',
        hashtags: full.hashtags || [],
        fontStyle: full.fontStyle || '',
        accentColor: full.accentColor || '',
        needsImage: full.needsImage || false,
      });
      setAutoSlug(false);
      setSaveError('');
      setModalMode('edit');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openView = async (concept: PhotoConcept) => {
    try {
      const full = await api.getPhotoConcept(concept.slug);
      setSelected(full);
      setModalMode('view');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      if (modalMode === 'create') {
        await api.createPhotoConcept({
          title: formData.title,
          post_type: formData.postType,
          target_platforms: formData.targetPlatforms,
          concept: formData.concept,
          tone: formData.tone,
          image_prompt: formData.imagePrompt || undefined,
          body_text: formData.bodyText || undefined,
          caption_text: formData.captionText || undefined,
        });
        toast.success('Photo concept created');
      } else if (modalMode === 'edit' && selected) {
        await api.updatePhotoConcept(selected.slug, {
          title: formData.title,
          post_type: formData.postType,
          target_platforms: formData.targetPlatforms,
          concept: formData.concept,
          tone: formData.tone,
          image_prompt: formData.imagePrompt || undefined,
          image_style: formData.imageStyle || undefined,
          caption_text: formData.captionText || undefined,
          body_text: formData.bodyText || undefined,
          top_text: formData.topText || undefined,
          bottom_text: formData.bottomText || undefined,
          stat_value: formData.statValue || undefined,
          stat_label: formData.statLabel || undefined,
          quote_text: formData.quoteText || undefined,
          quote_attribution: formData.quoteAttribution || undefined,
          job_title: formData.jobTitle || undefined,
          job_description: formData.jobDescription || undefined,
          job_budget: formData.jobBudget || undefined,
          pillar: formData.pillar || undefined,
          hashtags: formData.hashtags?.length ? formData.hashtags : undefined,
          font_style: formData.fontStyle || undefined,
          accent_color: formData.accentColor || undefined,
        });
        toast.success('Photo concept updated');
      }
      closeModal();
      await fetchConcepts();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    setDeleting(true);
    try {
      await api.deletePhotoConcept(slug);
      setDeleteConfirm(null);
      toast.success('Photo concept deleted');
      await fetchConcepts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async (slug: string) => {
    try {
      await api.approvePhotoConcept(slug);
      toast.success(`Approved '${slug}'`);
      setApproveSlug(null);
      await fetchConcepts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRender = async () => {
    if (!renderSlug) return;
    setRendering(true);
    try {
      await api.renderPhotoConcept(renderSlug);
      toast.success('Render job submitted');
      setRenderSlug(null);
      await fetchConcepts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRendering(false);
    }
  };

  const handleBatchGenerate = async () => {
    setBatchGenerating(true);
    try {
      await api.generatePhotoBatch(10);
      toast.success('Batch generation job submitted');
      await fetchConcepts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBatchGenerating(false);
    }
  };

  const filteredConcepts = statusFilter
    ? concepts.filter(c => c.status === statusFilter)
    : concepts;

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading photo concepts...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Photo Concepts</h2>
          <p className="text-sm text-gray-500 mt-1">{concepts.length} concept{concepts.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBatchGenerate}
            disabled={batchGenerating}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {batchGenerating ? 'Generating...' : 'Generate Batch'}
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New Concept
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Filter Bar */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="new">New</option>
          <option value="approved">Approved</option>
          <option value="rendered">Rendered</option>
          <option value="rejected">Rejected</option>
        </select>
        {statusFilter && (
          <span className="text-xs text-gray-500">
            ({filteredConcepts.length} result{filteredConcepts.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredConcepts.map((c) => {
              const badge = STATUS_BADGES[c.status] || STATUS_BADGES.new;
              return (
                <tr key={c.slug} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{c.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.postType || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatPlatforms(c.targetPlatforms)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openView(c)} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                      <button onClick={() => openEdit(c)} className="text-gray-600 hover:text-gray-800 text-sm">Edit</button>
                      {c.status === 'new' && (
                        <button
                          onClick={() => setApproveSlug(c.slug)}
                          className="text-yellow-600 hover:text-yellow-800 text-sm"
                        >
                          Approve
                        </button>
                      )}
                      {c.status === 'approved' && (
                        <button
                          onClick={() => setRenderSlug(c.slug)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Render
                        </button>
                      )}
                      {deleteConfirm === c.slug ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(c.slug)}
                            disabled={deleting}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            {deleting ? '...' : 'Confirm'}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(c.slug)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredConcepts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                {statusFilter ? 'No concepts found with this status.' : 'No concepts found. Create one to get started.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      {approveSlug && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setApproveSlug(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Approve &ldquo;{approveSlug}&rdquo;</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">Are you sure you want to approve this photo concept? It will be marked as approved and ready for rendering.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setApproveSlug(null)} className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800">Cancel</button>
                <button
                  onClick={() => handleApprove(approveSlug)}
                  className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render Modal */}
      {renderSlug && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setRenderSlug(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Render &ldquo;{renderSlug}&rdquo;</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">Submit this concept for rendering. A background job will be created to generate the output images.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setRenderSlug(null)} className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800">Cancel</button>
                <button
                  onClick={handleRender}
                  disabled={rendering}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {rendering ? 'Submitting...' : 'Submit Render'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit / View Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalMode === 'create' ? 'New Photo Concept' : modalMode === 'edit' ? `Edit: ${selected?.slug}` : selected?.title}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="p-4">
              {modalMode === 'view' && selected ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600">
                    <span>Status: <strong>{STATUS_BADGES[selected.status]?.label || selected.status}</strong></span>
                    <span>Type: <strong>{selected.postType || '—'}</strong></span>
                    {selected.targetPlatforms && selected.targetPlatforms.length > 0 && (
                      <span>Platforms: <strong>{formatPlatforms(selected.targetPlatforms)}</strong></span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">Concept</p>
                      <p className="text-gray-900 mt-1">{selected.concept || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Tone</p>
                      <p className="text-gray-900 mt-1">{selected.tone || '—'}</p>
                    </div>
                    {selected.imagePrompt && (
                      <div className="col-span-2">
                        <p className="text-gray-500 font-medium">Image Prompt</p>
                        <p className="text-gray-900 mt-1">{selected.imagePrompt}</p>
                      </div>
                    )}
                    {selected.imageStyle && (
                      <div className="col-span-2">
                        <p className="text-gray-500 font-medium">Image Style</p>
                        <p className="text-gray-900 mt-1">{selected.imageStyle}</p>
                      </div>
                    )}
                    {selected.captionText && (
                      <div className="col-span-2">
                        <p className="text-gray-500 font-medium">Caption</p>
                        <p className="text-gray-900 mt-1">{selected.captionText}</p>
                      </div>
                    )}
                    {selected.bodyText && (
                      <div className="col-span-2">
                        <p className="text-gray-500 font-medium">Body Text</p>
                        <p className="text-gray-900 mt-1">{selected.bodyText}</p>
                      </div>
                    )}
                    {selected.quoteText && (
                      <div className="col-span-2">
                        <p className="text-gray-500 font-medium">Quote</p>
                        <p className="text-gray-900 mt-1">&quot;{selected.quoteText}&quot;</p>
                        {selected.quoteAttribution && <p className="text-gray-700 mt-1">— {selected.quoteAttribution}</p>}
                      </div>
                    )}
                    {selected.statValue && (
                      <div>
                        <p className="text-gray-500 font-medium">Stat Value</p>
                        <p className="text-gray-900 mt-1">{selected.statValue}</p>
                      </div>
                    )}
                    {selected.statLabel && (
                      <div>
                        <p className="text-gray-500 font-medium">Stat Label</p>
                        <p className="text-gray-900 mt-1">{selected.statLabel}</p>
                      </div>
                    )}
                    {selected.hashtags && selected.hashtags.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-gray-500 font-medium">Hashtags</p>
                        <p className="text-gray-900 mt-1">{selected.hashtags.join(', ')}</p>
                      </div>
                    )}
                    {selected.accentColor && (
                      <div>
                        <p className="text-gray-500 font-medium">Accent Color</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div
                            className="w-8 h-8 rounded border border-gray-300"
                            style={{ backgroundColor: selected.accentColor }}
                          ></div>
                          <p className="text-gray-900">{selected.accentColor}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEdit(selected)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setFormData(d => ({
                          ...d,
                          title,
                          ...(autoSlug && modalMode === 'create' ? { slug: slugify(title) } : {}),
                        }));
                      }}
                      placeholder="e.g. Summer Campaign Teaser"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  {modalMode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => {
                          setAutoSlug(false);
                          setFormData(d => ({ ...d, slug: e.target.value }));
                        }}
                        placeholder="auto-generated-from-title"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Post Type *</label>
                      <input
                        type="text"
                        value={formData.postType}
                        onChange={(e) => setFormData(d => ({ ...d, postType: e.target.value }))}
                        placeholder="carousel, single, reel, story"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Platforms (comma-separated)</label>
                      <input
                        type="text"
                        value={formData.targetPlatforms.join(', ')}
                        onChange={(e) => setFormData(d => ({
                          ...d,
                          targetPlatforms: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                        }))}
                        placeholder="instagram, tiktok, linkedin"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Concept *</label>
                      <textarea
                        value={formData.concept}
                        onChange={(e) => setFormData(d => ({ ...d, concept: e.target.value }))}
                        rows={3}
                        placeholder="Describe the core concept..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                      <textarea
                        value={formData.tone}
                        onChange={(e) => setFormData(d => ({ ...d, tone: e.target.value }))}
                        rows={3}
                        placeholder="Professional, casual, inspirational, etc."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image Prompt</label>
                    <textarea
                      value={formData.imagePrompt}
                      onChange={(e) => setFormData(d => ({ ...d, imagePrompt: e.target.value }))}
                      rows={2}
                      placeholder="Detailed description for image generation..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image Style</label>
                      <input
                        type="text"
                        value={formData.imageStyle}
                        onChange={(e) => setFormData(d => ({ ...d, imageStyle: e.target.value }))}
                        placeholder="photorealistic, illustrated, minimal"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pillar</label>
                      <input
                        type="text"
                        value={formData.pillar}
                        onChange={(e) => setFormData(d => ({ ...d, pillar: e.target.value }))}
                        placeholder="e.g. education, wellness"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Caption Text</label>
                    <textarea
                      value={formData.captionText}
                      onChange={(e) => setFormData(d => ({ ...d, captionText: e.target.value }))}
                      rows={2}
                      placeholder="Social media caption..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Top Text</label>
                      <input
                        type="text"
                        value={formData.topText}
                        onChange={(e) => setFormData(d => ({ ...d, topText: e.target.value }))}
                        placeholder="Text overlay at top"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bottom Text</label>
                      <input
                        type="text"
                        value={formData.bottomText}
                        onChange={(e) => setFormData(d => ({ ...d, bottomText: e.target.value }))}
                        placeholder="Text overlay at bottom"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body Text</label>
                    <textarea
                      value={formData.bodyText}
                      onChange={(e) => setFormData(d => ({ ...d, bodyText: e.target.value }))}
                      rows={2}
                      placeholder="Main body content..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quote Text</label>
                      <textarea
                        value={formData.quoteText}
                        onChange={(e) => setFormData(d => ({ ...d, quoteText: e.target.value }))}
                        rows={2}
                        placeholder="Featured quote..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quote Attribution</label>
                      <input
                        type="text"
                        value={formData.quoteAttribution}
                        onChange={(e) => setFormData(d => ({ ...d, quoteAttribution: e.target.value }))}
                        placeholder="Author name"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stat Value</label>
                      <input
                        type="text"
                        value={formData.statValue}
                        onChange={(e) => setFormData(d => ({ ...d, statValue: e.target.value }))}
                        placeholder="85%"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stat Label</label>
                      <input
                        type="text"
                        value={formData.statLabel}
                        onChange={(e) => setFormData(d => ({ ...d, statLabel: e.target.value }))}
                        placeholder="improvement"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                      <input
                        type="text"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData(d => ({ ...d, jobTitle: e.target.value }))}
                        placeholder="Position title"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Job Budget</label>
                      <input
                        type="text"
                        value={formData.jobBudget}
                        onChange={(e) => setFormData(d => ({ ...d, jobBudget: e.target.value }))}
                        placeholder="e.g. $50-100k"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
                    <textarea
                      value={formData.jobDescription}
                      onChange={(e) => setFormData(d => ({ ...d, jobDescription: e.target.value }))}
                      rows={2}
                      placeholder="Job details..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Font Style</label>
                      <input
                        type="text"
                        value={formData.fontStyle}
                        onChange={(e) => setFormData(d => ({ ...d, fontStyle: e.target.value }))}
                        placeholder="sans-serif, serif, script"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                      <input
                        type="color"
                        value={formData.accentColor}
                        onChange={(e) => setFormData(d => ({ ...d, accentColor: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags (comma-separated)</label>
                    <input
                      type="text"
                      value={formData.hashtags.join(', ')}
                      onChange={(e) => setFormData(d => ({
                        ...d,
                        hashtags: e.target.value.split(',').map(h => h.trim()).filter(h => h)
                      }))}
                      placeholder="#tag1, #tag2, #tag3"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="needsImage"
                      checked={formData.needsImage}
                      onChange={(e) => setFormData(d => ({ ...d, needsImage: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="needsImage" className="ml-2 text-sm font-medium text-gray-700">
                      Needs Image Generation
                    </label>
                  </div>

                  {saveError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{saveError}</div>
                  )}

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button onClick={closeModal} className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800">Cancel</button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !formData.title || !formData.postType || !formData.concept}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
