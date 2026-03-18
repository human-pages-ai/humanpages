import { useState, useRef, useEffect } from 'react';
import { CompactCvProcessingBar } from '../components/CvProcessingBar';
import { POPULAR_SERVICE_CATEGORIES } from '../constants';
import type { Service } from '../types';

interface StepServicesProps {
  cvProcessing: boolean;
  cvData: any;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  equipment: string[];
  setEquipment: React.Dispatch<React.SetStateAction<string[]>>;
  onNext: () => void;
  onSkip: () => void;
  error: string;
}

export function StepServices({ cvProcessing, cvData, services, setServices, equipment, setEquipment, onNext, onSkip, error }: StepServicesProps) {
  const [addingService, setAddingService] = useState(false);
  const [newService, setNewService] = useState<Service>({ title: '', category: '', description: '', price: '', currency: 'USD', unit: 'per hour' });
  const [categoryError, setCategoryError] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [newEquipment, setNewEquipment] = useState('');

  const categoryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const priceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Clear all pending error timeouts on unmount
  useEffect(() => {
    return () => {
      if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current);
      if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
    };
  }, []);

  const handleCancelService = () => {
    setAddingService(false);
    setNewService({ title: '', category: '', description: '', price: '', currency: 'USD', unit: 'per hour' });
    setCategoryError(false);
    setPriceError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && addingService) {
      e.preventDefault();
      handleCancelService();
    }
  };

  const addSuggestedService = (svc: any) => {
    setServices(prev => [...prev, {
      title: svc.title || '',
      category: svc.category || '',
      description: svc.description || '',
      price: '',
      currency: 'USD',
      unit: 'per hour',
    }]);
  };

  const handleAddService = () => {
    if (!newService.title.trim() || !newService.category.trim()) {
      if (!newService.category.trim()) {
        setCategoryError(true);
        if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current);
        categoryTimeoutRef.current = setTimeout(() => setCategoryError(false), 1500);
      }
      return;
    }
    // Validate price minimum if provided
    if (newService.price.trim()) {
      const parsed = parseFloat(newService.price.trim());
      if (isNaN(parsed) || parsed <= 0) {
        setPriceError('Price must be greater than 0');
        if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
        priceTimeoutRef.current = setTimeout(() => setPriceError(''), 3000);
        return;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(newService.price.trim())) {
        setPriceError('Use a valid number (max 2 decimal places)');
        if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
        priceTimeoutRef.current = setTimeout(() => setPriceError(''), 3000);
        return;
      }
      if (parsed > 100000) {
        setPriceError('Price seems too high — double check');
        if (priceTimeoutRef.current) clearTimeout(priceTimeoutRef.current);
        priceTimeoutRef.current = setTimeout(() => setPriceError(''), 3000);
        return;
      }
    }
    setServices(prev => [...prev, { ...newService, title: newService.title.trim(), category: newService.category.trim() }]);
    setNewService({ title: '', category: '', description: '', price: '', currency: 'USD', unit: 'per hour' });
    setAddingService(false);
    setCategoryError(false);
    setPriceError('');
  };

  const handleRemoveService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <h2 data-step-heading tabIndex={-1} className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 outline-none">Your Services</h2>
      <p className="text-slate-600 mb-6">Add the services you offer</p>

      {cvProcessing && <CompactCvProcessingBar />}
      {error && <div role="alert" tabIndex={-1} className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 outline-none">{error}</div>}

      {/* CV-suggested services */}
      {cvData?.suggestedServices?.length > 0 && services.length === 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm font-medium text-orange-900 mb-2">Based on your CV, we suggest these services:</p>
          <div className="space-y-2">
            {cvData.suggestedServices.map((svc: any, idx: number) => (
              <button key={idx} type="button" onClick={() => addSuggestedService(svc)} className="w-full text-left p-3 bg-white border border-orange-200 rounded-lg hover:border-orange-400 transition-colors">
                <p className="font-medium text-slate-900 text-sm">{svc.title}</p>
                <p className="text-xs text-slate-500">{svc.category} — {svc.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Services</h3>

        {services.length > 0 && (
          <div className="space-y-3 mb-4">
            {services.map((svc, idx) => (
              <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{svc.title}</p>
                    <p className="text-xs text-slate-500">{svc.category}</p>
                  </div>
                  <button type="button" onClick={() => handleRemoveService(idx)} className="text-slate-400 hover:text-red-500 font-bold flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`Remove service: ${svc.title}`}>×</button>
                </div>
                {svc.description && <p className="text-xs text-slate-600 mb-2 line-clamp-2">{svc.description}</p>}
                {svc.price && <p className="text-xs text-slate-700 font-medium">{svc.currency} {svc.price}/{svc.unit}</p>}
              </div>
            ))}
          </div>
        )}

        {!addingService && (
          <button type="button" onClick={() => setAddingService(true)} disabled={services.length >= 5} aria-disabled={services.length >= 5} className={`w-full py-3 min-h-[44px] border-2 border-dashed rounded-lg text-sm font-medium mb-4 transition-colors ${services.length >= 5 ? 'border-slate-300 text-slate-400 bg-slate-50 cursor-not-allowed opacity-50' : 'border-orange-300 text-orange-600 hover:text-orange-700 hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100'}`}>+ Add a Service</button>
        )}

        {addingService && (
          <div className="border border-slate-300 rounded-lg p-4 mb-4 bg-white" onKeyDown={handleKeyDown}>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Service Title</label>
              <input type="text" value={newService.title} onChange={(e) => setNewService({ ...newService, title: e.target.value.slice(0, 100) })} maxLength={100} placeholder="e.g., Social Media Management" className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={newService.category} onChange={(e) => { setNewService({ ...newService, category: e.target.value }); setCategoryError(false); }} className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${categoryError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}>
                <option value="">Select a category...</option>
                {POPULAR_SERVICE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value.slice(0, 500) })} maxLength={500} placeholder="Describe what clients get..." rows={2} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
              {newService.description.length > 0 && (
                <p className={`text-xs mt-1 ${newService.description.length >= 480 ? 'text-red-500 font-medium' : newService.description.length >= 400 ? 'text-orange-600' : 'text-slate-400'}`}>{newService.description.length}/500</p>
              )}
            </div>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                <input type="text" inputMode="decimal" value={newService.price} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setNewService({ ...newService, price: val }); setPriceError(''); } }} placeholder="50" className={`w-full px-3 py-2.5 sm:py-2 border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${priceError ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} />
                {priceError && <p className="text-xs text-red-500 mt-1">{priceError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select value={newService.currency} onChange={(e) => setNewService({ ...newService, currency: e.target.value })} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="GBP">🇬🇧 GBP</option>
                  <option value="JPY">🇯🇵 JPY</option>
                  <option value="CAD">🇨🇦 CAD</option>
                  <option value="AUD">🇦🇺 AUD</option>
                  <option value="CHF">🇨🇭 CHF</option>
                  <option value="CNY">🇨🇳 CNY</option>
                  <option value="INR">🇮🇳 INR</option>
                  <option value="BRL">🇧🇷 BRL</option>
                  <option value="MXN">🇲🇽 MXN</option>
                  <option value="KRW">🇰🇷 KRW</option>
                  <option value="SGD">🇸🇬 SGD</option>
                  <option value="HKD">🇭🇰 HKD</option>
                  <option value="TRY">🇹🇷 TRY</option>
                  <option value="ZAR">🇿🇦 ZAR</option>
                  <option value="NGN">🇳🇬 NGN</option>
                  <option value="KES">🇰🇪 KES</option>
                  <option value="GHS">🇬🇭 GHS</option>
                  <option value="PHP">🇵🇭 PHP</option>
                  <option value="IDR">🇮🇩 IDR</option>
                  <option value="THB">🇹🇭 THB</option>
                  <option value="VND">🇻🇳 VND</option>
                  <option value="PKR">🇵🇰 PKR</option>
                  <option value="BDT">🇧🇩 BDT</option>
                  <option value="EGP">🇪🇬 EGP</option>
                  <option value="COP">🇨🇴 COP</option>
                  <option value="PEN">🇵🇪 PEN</option>
                  <option value="ARS">🇦🇷 ARS</option>
                  <option value="CLP">🇨🇱 CLP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                <select value={newService.unit} onChange={(e) => setNewService({ ...newService, unit: e.target.value })} className="w-full px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                  <option value="per hour">Per Hour</option>
                  <option value="per task">Per Task</option>
                  <option value="per word">Per Word</option>
                  <option value="per page">Per Page</option>
                  <option value="negotiable">Negotiable</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddService} disabled={!newService.title.trim() || !newService.category.trim()} className="px-4 py-2.5 sm:py-2 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors min-h-[44px]">Add Service</button>
              <button type="button" onClick={handleCancelService} className="px-4 py-2.5 sm:py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[44px]">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Equipment & Tools ─── */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Equipment & Tools (Optional)</label>
        <p className="text-xs text-slate-400 mb-3">What do you have access to? Agents match this to physical tasks.</p>
        {equipment.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {equipment.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setEquipment(prev => prev.filter((_, i) => i !== idx))}
                aria-label={`Remove equipment: ${item}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 min-h-[44px]"
              >
                {item}<span aria-hidden="true" className="text-orange-200 ml-0.5 text-base leading-none">&times;</span>
              </button>
            ))}
          </div>
        )}
        {equipment.length < 20 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newEquipment}
              onChange={(e) => setNewEquipment(e.target.value.slice(0, 50))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = newEquipment.trim();
                  if (trimmed && !equipment.some(eq => eq.toLowerCase() === trimmed.toLowerCase())) {
                    setEquipment(prev => [...prev, trimmed]);
                    setNewEquipment('');
                  }
                }
              }}
              maxLength={50}
              placeholder="e.g., DSLR Camera, Drone, Car..."
              aria-label="Add equipment or tool"
              className="flex-1 px-3 py-2.5 sm:py-2 border border-slate-300 rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = newEquipment.trim();
                if (trimmed && !equipment.some(eq => eq.toLowerCase() === trimmed.toLowerCase())) {
                  setEquipment(prev => [...prev, trimmed]);
                  setNewEquipment('');
                }
              }}
              disabled={!newEquipment.trim()}
              className="px-4 py-2.5 sm:py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 min-h-[44px]"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onNext} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500">Continue</button>
        <button type="button" onClick={onSkip} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 active:bg-slate-300">Skip for now</button>
        <p className="text-xs text-slate-500 text-center">Step 4 of 7</p>
      </div>
    </>
  );
}
