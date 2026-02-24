import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { PhotoConcept } from '../../types/admin';

type ModalMode = 'create' | 'edit' | 'view' | null;

const POST_TYPES = [
  { value: 'meme_classic', label: 'Meme — Classic' },
  { value: 'meme_caption', label: 'Meme — Caption' },
  { value: 'meme_multi_panel', label: 'Meme — Multi-Panel' },
  { value: 'meme_reaction', label: 'Meme — Reaction' },
  { value: 'meme_labeled', label: 'Meme — Labeled' },
  { value: 'job_screenshot', label: 'Job Screenshot' },
  { value: 'chat_screenshot', label: 'Chat Screenshot' },
  { value: 'quote_card', label: 'Quote Card' },
  { value: 'stat_card', label: 'Stat Card' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'listicle', label: 'Listicle' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'infographic', label: 'Infographic' },
];

const PLATFORMS = ['twitter', 'instagram', 'facebook', 'reddit', 'linkedin', 'tiktok'];

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-gray-100 text-gray-700' },
  approved: { label: 'Approved', cls: 'bg-blue-100 text-blue-700' },
  rendered: { label: 'Rendered', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

const VERDICT_BADGES: Record<string, { cls: string }> = {
  strong: { cls: 'text-green-700 bg-green-50' },
  promising: { cls: 'text-blue-700 bg-blue-50' },
  needs_work: { cls: 'text-yellow-700 bg-yellow-50' },
  weak: { cls: 'text-red-700 bg-red-50' },
};

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export default function AdminPhotoConcepts() {
  const [concepts, setConcepts] = useState<PhotoConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<PhotoConcept | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);

  // Action states
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [approveSlug, setApproveSlug] = useState<string | null>(null);
  const [renderSlug, setRenderSlug] = useState<string | null>(null);
  const [renderTier, setRenderTier] = useState('final');
  const [rendering, setRendering] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [assessing, setAssessing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  function emptyForm() {
    return {
      title: '', slug: '', postType: 'meme_caption', targetPlatforms: ['twitter', 'instagram', 'facebook'] as string[],
      concept: '', tone: 'deadpan', imagePrompt: '', imageStyle: 'photorealistic',
      captionText: '', bodyText: '', topText: '', bottomText: '',
      statValue: '', statLabel: '', quoteText: '', quoteAttribution: '',
      jobTitle: '', jobDescription: '', jobBudget: '',
      pillar: '', hashtags: [] as string[], fontStyle: 'sans', accentColor: '#00d2ff',
    };
  }

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

  useEffect(() => { fetchConcepts(); }, [fetchConcepts]);

  const openCreate = () => {
    setFormData(emptyForm());
    setAutoSlug(true);
    setSaveError('');
    setModalMode('create');
  };

  const openEdit = async (concept: PhotoConcept) => {
    try {
      const full = await api.getPhotoConcept(concept.slug);
      setSelected(full);
      setFormData({
        title: full.title, slug: full.slug, postType: full.postType,
        targetPlatforms: full.targetPlatforms || [], concept: full.concept, tone: full.tone,
        imagePrompt: full.imagePrompt || '', imageStyle: full.imageStyle || 'photorealistic',
        captionText: full.captionText || '', bodyText: full.bodyText || '',
        topText: full.topText || '', bottomText: full.bottomText || '',
        statValue: full.statValue || '', statLabel: full.statLabel || '',
        quoteText: full.quoteText || '', quoteAttribution: full.quoteAttribution || '',
        jobTitle: full.jobTitle || '', jobDescription: full.jobDescription || '',
        jobBudget: full.jobBudget || '', pillar: full.pillar || '',
        hashtags: full.hashtags || [], fontStyle: full.fontStyle || 'sans',
        accentColor: full.accentColor || '#00d2ff',
      });
      setAutoSlug(false);
      setSaveError('');
      setModalMode('edit');
    } catch (err: any) { toast.error(err.message); }
  };

  const openView = async (concept: PhotoConcept) => {
    try {
      const full = await api.getPhotoConcept(concept.slug);
      setSelected(full);
      setModalMode('view');
    } catch (err: any) { toast.error(err.message); }
  };

  const closeModal = () => { setModalMode(null); setSelected(null); setSaveError(''); };

  const handleSave = async () => {
    setSaving(true); setSaveError('');
    try {
      if (modalMode === 'create') {
        await api.createPhotoConcept({
          title: formData.title, post_type: formData.postType,
          target_platforms: formData.targetPlatforms, concept: formData.concept,
          tone: formData.tone, image_prompt: formData.imagePrompt || undefined,
          body_text: formData.bodyText || undefined, caption_text: formData.captionText || undefined,
        });
        toast.success('Photo concept created');
      } else if (modalMode === 'edit' && selected) {
        await api.updatePhotoConcept(selected.slug, {
          title: formData.title, post_type: formData.postType,
          target_platforms: formData.targetPlatforms, concept: formData.concept,
          tone: formData.tone, image_prompt: formData.imagePrompt || undefined,
          image_style: formData.imageStyle || undefined,
          caption_text: formData.captionText || undefined, body_text: formData.bodyText || undefined,
          top_text: formData.topText || undefined, bottom_text: formData.bottomText || undefined,
          stat_value: formData.statValue || undefined, stat_label: formData.statLabel || undefined,
          quote_text: formData.quoteText || undefined, quote_attribution: formData.quoteAttribution || undefined,
          job_title: formData.jobTitle || undefined, job_description: formData.jobDescription || undefined,
          job_budget: formData.jobBudget || undefined, pillar: formData.pillar || undefined,
          hashtags: formData.hashtags?.length ? formData.hashtags : undefined,
          font_style: formData.fontStyle || undefined, accent_color: formData.accentColor || undefined,
        });
        toast.success('Photo concept updated');
      }
      closeModal();
      await fetchConcepts();
    } catch (err: any) { setSaveError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (slug: string) => {
    setDeleting(true);
    try {
      await api.deletePhotoConcept(slug);
      setDeleteConfirm(null);
      toast.success('Deleted');
      await fetchConcepts();
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  const handleApprove = async (slug: string) => {
    try {
      await api.approvePhotoConcept(slug);
      toast.success(`Approved '${slug}'`);
      setApproveSlug(null);
      await fetchConcepts();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleRender = async () => {
    if (!renderSlug) return;
    setRendering(true);
    try {
      await api.renderPhotoConcept(renderSlug);
      toast.success(`Render started (${renderTier} tier)`);
      setRenderSlug(null);
      await fetchConcepts();
    } catch (err: any) { toast.error(err.message); }
    finally { setRendering(false); }
  };

  const handleBatchGenerate = async () => {
    setBatchGenerating(true);
    try {
      await api.generatePhotoBatch(10);
      toast.success('Batch generation started');
      setTimeout(fetchConcepts, 3000); // refresh after a delay
    } catch (err: any) { toast.error(err.message); }
    finally { setBatchGenerating(false); }
  };

  const handleAssessAll = async () => {
    setAssessing(true);
    try {
      const data = await api.assessAllPhotoConcepts();
      toast.success(data.message || 'Assessment complete');
      await fetchConcepts();
    } catch (err: any) { toast.error(err.message); }
    finally { setAssessing(false); }
  };

  // Filter + sort
  let filtered = statusFilter ? concepts.filter(c => c.status === statusFilter) : concepts;
  if (sortBy === 'score') {
    filtered = [...filtered].sort((a, b) => {
      const sa = (a as any).assessmentScore ?? -1;
      const sb = (b as any).assessmentScore ?? -1;
      return sb - sa;
    });
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Loading photo concepts...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Photo Concepts</h2>
          <p className="text-sm text-gray-500 mt-1">
            {concepts.length} concept{concepts.length !== 1 ? 's' : ''}
            {concepts.filter(c => (c as any).assessmentScore != null).length > 0 &&
              ` · ${concepts.filter(c => (c as any).assessmentScore != null).length} scored`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAssessAll} disabled={assessing}
            className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {assessing ? 'Scoring...' : 'Score All'}
          </button>
          <button onClick={handleBatchGenerate} disabled={batchGenerating}
            className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {batchGenerating ? 'Generating...' : 'Generate Batch'}
          </button>
          <button onClick={openCreate}
            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + New
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Status:</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="new">New</option>
            <option value="approved">Approved</option>
            <option value="rendered">Rendered</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort:</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
            <option value="score">By Score</option>
            <option value="date">By Date</option>
          </select>
        </div>
        {statusFilter && <span className="text-xs text-gray-500">({filtered.length} results)</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map(c => {
              const badge = STATUS_BADGES[c.status] || STATUS_BADGES.new;
              const score = (c as any).assessmentScore;
              const verdict = (c as any).assessmentVerdict;
              const verdictBadge = verdict ? VERDICT_BADGES[verdict] : null;
              const postLabel = POST_TYPES.find(p => p.value === c.postType)?.label || c.postType || '—';

              return (
                <tr key={c.slug} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {score != null ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${verdictBadge?.cls || 'bg-gray-100 text-gray-600'}`}>
                        {score}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{c.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{postLabel}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.targetPlatforms?.length ? c.targetPlatforms.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openView(c)} className="text-blue-600 hover:text-blue-800 text-xs">View</button>
                      <button onClick={() => openEdit(c)} className="text-gray-600 hover:text-gray-800 text-xs">Edit</button>
                      {c.status === 'new' && (
                        <button onClick={() => setApproveSlug(c.slug)} className="text-yellow-600 hover:text-yellow-800 text-xs">Approve</button>
                      )}
                      {(c.status === 'approved' || c.status === 'new') && (
                        <button onClick={() => { setRenderSlug(c.slug); setRenderTier('final'); }} className="text-green-600 hover:text-green-800 text-xs">Render</button>
                      )}
                      {deleteConfirm === c.slug ? (
                        <span className="flex items-center gap-1">
                          <button onClick={() => handleDelete(c.slug)} disabled={deleting} className="text-red-600 text-xs font-medium">
                            {deleting ? '...' : 'Yes'}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 text-xs">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(c.slug)} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                {statusFilter ? 'No concepts with this status.' : 'No concepts yet. Generate a batch to get started.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      {approveSlug && (
        <Modal onClose={() => setApproveSlug(null)} title={`Approve "${approveSlug}"?`} narrow>
          <p className="text-sm text-gray-600 mb-4">This will copy the concept to the production queue.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setApproveSlug(null)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
            <button onClick={() => handleApprove(approveSlug)} className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600">Approve</button>
          </div>
        </Modal>
      )}

      {/* Render Modal with tier selection */}
      {renderSlug && (
        <Modal onClose={() => setRenderSlug(null)} title={`Render "${renderSlug}"`} narrow>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Select quality tier for rendering:</p>
            <div className="flex gap-2">
              {(['nano', 'draft', 'final'] as const).map(tier => (
                <button key={tier} onClick={() => setRenderTier(tier)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                    renderTier === tier
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <div className="font-medium capitalize">{tier}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {tier === 'nano' ? '~$0.003' : tier === 'draft' ? '~$0.02' : '~$0.15'}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenderSlug(null)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
              <button onClick={handleRender} disabled={rendering}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                {rendering ? 'Starting...' : `Render (${renderTier})`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create / Edit / View Modal */}
      {modalMode && (
        <Modal onClose={closeModal} title={
          modalMode === 'create' ? 'New Photo Concept' :
          modalMode === 'edit' ? `Edit: ${selected?.slug}` :
          selected?.title || ''
        }>
          {modalMode === 'view' && selected ? (
            <ViewMode concept={selected} onEdit={() => openEdit(selected)} />
          ) : (
            <EditForm
              formData={formData} setFormData={setFormData}
              modalMode={modalMode} autoSlug={autoSlug}
              saving={saving} saveError={saveError}
              onSave={handleSave} onCancel={closeModal}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ───

function Modal({ children, onClose, title, narrow }: { children: React.ReactNode; onClose: () => void; title: string; narrow?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto ${narrow ? 'max-w-sm' : 'max-w-3xl'}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ViewMode({ concept, onEdit }: { concept: PhotoConcept; onEdit: () => void }) {
  const score = (concept as any).assessmentScore;
  const verdict = (concept as any).assessmentVerdict;
  const postLabel = POST_TYPES.find(p => p.value === concept.postType)?.label || concept.postType;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGES[concept.status]?.cls || 'bg-gray-100'}`}>
          {STATUS_BADGES[concept.status]?.label || concept.status}
        </span>
        <span className="text-gray-600">Type: <strong>{postLabel}</strong></span>
        {concept.targetPlatforms?.length > 0 && (
          <span className="text-gray-600">Platforms: <strong>{concept.targetPlatforms.join(', ')}</strong></span>
        )}
        {score != null && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${VERDICT_BADGES[verdict || '']?.cls || 'bg-gray-100'}`}>
            Score: {score}/100 ({verdict})
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Concept" value={concept.concept} span={2} />
        <Field label="Tone" value={concept.tone} />
        <Field label="Pillar" value={concept.pillar} />
        {concept.imagePrompt && <Field label="Image Prompt" value={concept.imagePrompt} span={2} />}
        {concept.captionText && <Field label="Caption" value={concept.captionText} span={2} />}
        {concept.bodyText && <Field label="Body Text" value={concept.bodyText} span={2} />}
        {concept.topText && <Field label="Top Text" value={concept.topText} />}
        {concept.bottomText && <Field label="Bottom Text" value={concept.bottomText} />}
        {concept.quoteText && (
          <div className="col-span-2">
            <p className="text-gray-500 font-medium">Quote</p>
            <p className="text-gray-900 mt-1 italic">&ldquo;{concept.quoteText}&rdquo;</p>
            {concept.quoteAttribution && <p className="text-gray-600">— {concept.quoteAttribution}</p>}
          </div>
        )}
        {concept.statValue && <Field label="Stat Value" value={concept.statValue} />}
        {concept.statLabel && <Field label="Stat Label" value={concept.statLabel} />}
        {concept.jobTitle && <Field label="Job Title" value={concept.jobTitle} />}
        {concept.jobBudget && <Field label="Job Budget" value={concept.jobBudget} />}
        {concept.jobDescription && <Field label="Job Description" value={concept.jobDescription} span={2} />}
        {concept.hashtags && concept.hashtags.length > 0 && (
          <Field label="Hashtags" value={concept.hashtags.join(', ')} span={2} />
        )}
        {concept.accentColor && (
          <div>
            <p className="text-gray-500 font-medium">Accent</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: concept.accentColor }} />
              <span className="text-gray-700 font-mono text-xs">{concept.accentColor}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 pt-4 border-t">
        <button onClick={onEdit} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Edit</button>
      </div>
    </div>
  );
}

function Field({ label, value, span }: { label: string; value?: string | null; span?: number }) {
  if (!value) return null;
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <p className="text-gray-500 font-medium">{label}</p>
      <p className="text-gray-900 mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function EditForm({ formData, setFormData, modalMode, autoSlug, saving, saveError, onSave, onCancel }: {
  formData: any; setFormData: (fn: (d: any) => any) => void;
  modalMode: string; autoSlug: boolean;
  saving: boolean; saveError: string;
  onSave: () => void; onCancel: () => void;
}) {
  // Show/hide fields based on post type
  const isMeme = formData.postType.startsWith('meme_');
  const isJob = formData.postType === 'job_screenshot';
  const isQuote = formData.postType === 'quote_card';
  const isStat = formData.postType === 'stat_card';
  const isChat = formData.postType === 'chat_screenshot';

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input type="text" value={formData.title}
          onChange={e => {
            const title = e.target.value;
            setFormData((d: any) => ({ ...d, title, ...(autoSlug && modalMode === 'create' ? { slug: slugify(title) } : {}) }));
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Post Type + Platforms */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Post Type *</label>
          <select value={formData.postType} onChange={e => setFormData((d: any) => ({ ...d, postType: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {POST_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Platforms</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PLATFORMS.map(p => (
              <button key={p} type="button"
                onClick={() => setFormData((d: any) => ({
                  ...d,
                  targetPlatforms: d.targetPlatforms.includes(p)
                    ? d.targetPlatforms.filter((t: string) => t !== p)
                    : [...d.targetPlatforms, p]
                }))}
                className={`px-2 py-0.5 rounded text-xs font-medium border ${
                  formData.targetPlatforms.includes(p)
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Concept + Tone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Concept *</label>
          <textarea value={formData.concept} onChange={e => setFormData((d: any) => ({ ...d, concept: e.target.value }))}
            rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
          <select value={formData.tone} onChange={e => setFormData((d: any) => ({ ...d, tone: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {['absurdist', 'deadpan', 'relatable', 'sarcastic', 'wholesome', 'professional', 'provocative'].map(t =>
              <option key={t} value={t}>{t}</option>
            )}
          </select>
        </div>
      </div>

      {/* Image prompt (only for meme types) */}
      {isMeme && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image Prompt</label>
          <textarea value={formData.imagePrompt} onChange={e => setFormData((d: any) => ({ ...d, imagePrompt: e.target.value }))}
            rows={2} placeholder="Flux prompt for the image..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
        </div>
      )}

      {/* Meme text fields */}
      {(formData.postType === 'meme_classic') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Top Text (ALL CAPS)</label>
            <input type="text" value={formData.topText} onChange={e => setFormData((d: any) => ({ ...d, topText: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bottom Text (ALL CAPS)</label>
            <input type="text" value={formData.bottomText} onChange={e => setFormData((d: any) => ({ ...d, bottomText: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      {/* Caption text (for meme_caption and general) */}
      {(formData.postType === 'meme_caption' || formData.postType === 'announcement') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Caption Text</label>
          <textarea value={formData.captionText} onChange={e => setFormData((d: any) => ({ ...d, captionText: e.target.value }))}
            rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      )}

      {/* Quote fields */}
      {isQuote && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quote Text</label>
            <textarea value={formData.quoteText} onChange={e => setFormData((d: any) => ({ ...d, quoteText: e.target.value }))}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attribution</label>
            <input type="text" value={formData.quoteAttribution}
              onChange={e => setFormData((d: any) => ({ ...d, quoteAttribution: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      {/* Stat fields */}
      {isStat && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stat Value</label>
            <input type="text" value={formData.statValue} onChange={e => setFormData((d: any) => ({ ...d, statValue: e.target.value }))}
              placeholder="0%" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stat Label</label>
            <input type="text" value={formData.statLabel} onChange={e => setFormData((d: any) => ({ ...d, statLabel: e.target.value }))}
              placeholder="platform fees" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      {/* Job fields */}
      {isJob && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input type="text" value={formData.jobTitle} onChange={e => setFormData((d: any) => ({ ...d, jobTitle: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
              <input type="text" value={formData.jobBudget} onChange={e => setFormData((d: any) => ({ ...d, jobBudget: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
            <textarea value={formData.jobDescription} onChange={e => setFormData((d: any) => ({ ...d, jobDescription: e.target.value }))}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </>
      )}

      {/* Chat / Body text */}
      {(isChat || formData.postType === 'testimonial' || formData.postType === 'comparison') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body Text</label>
          <textarea value={formData.bodyText} onChange={e => setFormData((d: any) => ({ ...d, bodyText: e.target.value }))}
            rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
        </div>
      )}

      {/* Styling */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pillar</label>
          <select value={formData.pillar} onChange={e => setFormData((d: any) => ({ ...d, pillar: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">None</option>
            <option value="absurd_job_postings">Absurd Job Postings</option>
            <option value="my_boss_is_a_robot">My Boss Is a Robot</option>
            <option value="platform_roast">Platform Roast</option>
            <option value="ai_human_future">AI + Human Future</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Font</label>
          <select value={formData.fontStyle} onChange={e => setFormData((d: any) => ({ ...d, fontStyle: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="impact">Impact (meme)</option>
            <option value="sans">Sans (clean)</option>
            <option value="serif">Serif (formal)</option>
            <option value="mono">Mono (tech)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Accent</label>
          <input type="color" value={formData.accentColor}
            onChange={e => setFormData((d: any) => ({ ...d, accentColor: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg h-9" />
        </div>
      </div>

      {saveError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{saveError}</div>}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 text-sm">Cancel</button>
        <button onClick={onSave} disabled={saving || !formData.title || !formData.concept}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save'}
        </button>
      </div>
    </div>
  );
}
