import React, { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface ProfilePhotoProps {
  photoUrl?: string;
  photoStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  name: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-20 h-20 text-xl',
  lg: 'w-28 h-28 text-3xl',
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB raw — will be cropped+compressed before upload

/**
 * Crop an image using canvas and return a WebP File ready for upload.
 * Outputs a 512x512 image (server further resizes to 256x256) for retina displays.
 */
async function cropImage(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      'image/webp',
      0.75,
    );
  });

  return new File([blob], 'profile-photo.webp', { type: 'image/webp' });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function ProfilePhoto({
  photoUrl,
  photoStatus = 'none',
  name,
  onUpload,
  onDelete,
  size = 'md',
}: ProfilePhotoProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Cropper state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Prevent selecting a new file while upload is in progress
    if (uploading) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t('dashboard.photo.invalidType', 'Only JPEG, PNG, and WebP images are allowed'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('dashboard.photo.tooLarge', 'Image must be under 10MB'));
      return;
    }

    // Open cropper modal
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;

    setUploading(true);
    try {
      const croppedFile = await cropImage(cropSrc, croppedAreaPixels);
      closeCropper();
      await onUpload(croppedFile);
      toast.success(t('dashboard.photo.uploaded', 'Photo uploaded'));
    } catch (err: any) {
      toast.error(err.message || t('dashboard.photo.uploadFailed', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCroppedAreaPixels(null);
  };

  const handleDelete = async () => {
    setUploading(true);
    try {
      await onDelete();
      toast.success(t('dashboard.photo.deleted', 'Photo removed'));
    } catch (err: any) {
      toast.error(err.message || t('dashboard.photo.deleteFailed', 'Failed to remove photo'));
    } finally {
      setUploading(false);
    }
  };

  // Reset image error state when URL changes (e.g., after re-fetch)
  const prevUrlRef = useRef(photoUrl);
  if (photoUrl !== prevUrlRef.current) {
    prevUrlRef.current = photoUrl;
    if (imgError) setImgError(false);
  }

  const displayUrl = photoUrl;
  const hasPhoto = !!displayUrl && photoStatus !== 'rejected' && !imgError;
  const sizeClass = SIZE_CLASSES[size];

  const ringClass = photoStatus === 'pending'
    ? 'ring-2 ring-yellow-400'
    : photoStatus === 'approved'
    ? 'ring-2 ring-green-400'
    : photoStatus === 'rejected'
    ? 'ring-2 ring-red-400'
    : '';

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`relative rounded-full overflow-hidden bg-blue-100 text-blue-600 font-semibold flex items-center justify-center ${sizeClass} ${ringClass}`}>
          {hasPhoto ? (
            <img
              src={displayUrl}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span aria-hidden="true">{getInitials(name)}</span>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center" role="status">
              <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24" aria-label={t('dashboard.photo.uploading', 'Uploading...')}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-1">
          {photoStatus === 'pending' && (
            <span className="text-xs text-yellow-600 font-medium">
              {t('dashboard.photo.reviewing', 'Photo under review')}
            </span>
          )}
          {photoStatus === 'rejected' && (
            <span className="text-xs text-red-600 font-medium">
              {t('dashboard.photo.rejected', 'Photo rejected')}
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
            >
              {hasPhoto
                ? t('dashboard.photo.change', 'Change')
                : t('dashboard.photo.add', 'Add photo')}
            </button>
            {hasPhoto && photoStatus !== 'none' && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={uploading}
                className="text-xs text-red-500 hover:text-red-400 font-medium disabled:opacity-50"
              >
                {t('dashboard.photo.remove', 'Remove')}
              </button>
            )}
          </div>
        </div>

        {/* File input — accept camera on mobile via capture attribute */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Crop Modal */}
      {cropSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeCropper(); }}
        >
          <div role="dialog" aria-modal="true" aria-label={t('dashboard.photo.cropTitle', 'Crop your photo')} className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {t('dashboard.photo.cropTitle', 'Crop your photo')}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('dashboard.photo.cropHint', 'Pinch or scroll to zoom, drag to reposition')}
              </p>
            </div>

            {/* Cropper area */}
            <div className="relative w-full" style={{ height: '320px' }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-4 py-2">
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                aria-label={t('dashboard.photo.zoom', 'Zoom')}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-4 py-3 border-t border-gray-200">
              <button
                type="button"
                onClick={closeCropper}
                disabled={uploading}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                disabled={uploading}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {uploading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('dashboard.photo.uploading', 'Uploading...')}
                  </>
                ) : (
                  t('dashboard.photo.save', 'Save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
