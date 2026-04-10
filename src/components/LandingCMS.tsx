import React, { useState, useEffect } from 'react';
import { 
  Save, 
  X, 
  Image as ImageIcon, 
  Type, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Loader2,
  Clock,
  Edit3,
  Check,
  Palette,
  Hash,
  HelpCircle,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { apiFetch } from '../lib/utils';

interface LandingCMSProps {
  config: any;
  onSave: (newConfig: any) => Promise<void>;
  onClose: () => void;
}

export default function LandingCMS({ config: initialConfig, onSave, onClose }: LandingCMSProps) {
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hero' | 'features' | 'premium' | 'how' | 'testimonials' | 'logo' | 'faq' | 'footer' | 'pages'>('hero');

  const handleUpdate = (path: string, value: any) => {
    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      const parts = path.split('.');
      let current = newConfig;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return newConfig;
    });
  };

  const handleImageUpload = async (path: string, file: File) => {
    setIsUploading(path);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        let userId = '0';
        try {
          const savedUser = localStorage.getItem('user');
          if (savedUser) {
            const u = JSON.parse(savedUser);
            userId = u?.id?.toString() || '0';
          }
        } catch (e) {}

        console.log(`[CMS] Uploading image for path: ${path}, size: ${base64.length} chars`);
        const res = await apiFetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId
          },
          body: JSON.stringify({ image: base64, folder: 'landing' })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        console.log(`[CMS] Upload success for path: ${path}, URL length: ${data.url?.length}`);
        
        if (data.url) {
          handleUpdate(path, data.url);
          toast.success('Image uploaded successfully');
        } else {
          throw new Error('No URL returned from server');
        }
      } catch (err: any) {
        console.error('[CMS] Image upload error:', err);
        toast.error(`Upload failed: ${err.message}`);
      } finally {
        setIsUploading(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all landing page settings to defaults? This cannot be undone.')) {
      // We need to get the defaults from the server or just hardcode them here
      // For now, let's just allow clearing the current config
      toast.info('Please refresh the page to see default settings if you haven\'t saved yet.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(config);
      toast.success('Landing page updated successfully');
      onClose();
    } catch (err) {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-zinc-900 border-l border-white/10 z-[60] shadow-2xl flex flex-col">
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-brand" />
          <h2 className="text-lg font-bold text-white">Landing CMS</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleReset}
            className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"
            title="Reset to defaults"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-white/10 overflow-x-auto custom-scrollbar">
        {[
          { id: 'hero', label: 'Hero' },
          { id: 'logo', label: 'Brand' },
          { id: 'features', label: 'Features' },
          { id: 'premium', label: 'Premium' },
          { id: 'how', label: 'How' },
          { id: 'testimonials', label: 'Reviews' },
          { id: 'faq', label: 'FAQ' },
          { id: 'footer', label: 'Footer' },
          { id: 'pages', label: 'Pages' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-3 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'text-brand border-b-2 border-brand' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {activeTab === 'hero' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Badge Text</label>
              <input
                type="text"
                value={config.hero.badge}
                onChange={(e) => handleUpdate('hero.badge', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Main Title</label>
              <textarea
                value={config.hero.title}
                onChange={(e) => handleUpdate('hero.title', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Subtitle</label>
              <textarea
                value={config.hero.subtitle}
                onChange={(e) => handleUpdate('hero.subtitle', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">App Store URL</label>
              <input
                type="text"
                value={config.hero.appStoreUrl}
                onChange={(e) => handleUpdate('hero.appStoreUrl', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Play Store URL</label>
              <input
                type="text"
                value={config.hero.playStoreUrl}
                onChange={(e) => handleUpdate('hero.playStoreUrl', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Hero Image</label>
              <div className="relative group aspect-video rounded-xl overflow-hidden border border-white/10">
                <img src={config.hero.image} alt="Hero" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload('hero.image', e.target.files[0])}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-white" />
                    <span className="text-xs font-bold text-white">Change Image</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logo' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">App Name / Logo Text</label>
              <input
                type="text"
                value={config.logo.text}
                onChange={(e) => handleUpdate('logo.text', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Logo Image (Optional)</label>
              <div className="relative group aspect-square w-24 rounded-xl overflow-hidden border border-white/10 bg-black/30">
                {config.logo.url ? (
                  <img src={config.logo.url} alt="Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload('logo.url', e.target.files[0])}
                  />
                  <ImageIcon className="w-5 h-5 text-white" />
                </label>
                {config.logo.url && (
                  <button 
                    onClick={() => handleUpdate('logo.url', '')}
                    className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">Used in navigation and across the app.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Favicon (Optional)</label>
              <div className="relative group aspect-square w-12 rounded-xl overflow-hidden border border-white/10 bg-black/30">
                {config.logo.favicon ? (
                  <img src={config.logo.favicon} alt="Favicon" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload('logo.favicon', e.target.files[0])}
                  />
                  <ImageIcon className="w-4 h-4 text-white" />
                </label>
                {config.logo.favicon && (
                  <button 
                    onClick={() => handleUpdate('logo.favicon', '')}
                    className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">The small icon in browser tabs.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Brand Major Color</label>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl border border-white/10 shadow-lg"
                  style={{ backgroundColor: config.brandColor }}
                />
                <div className="flex-1 relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={config.brandColor}
                    onChange={(e) => handleUpdate('brandColor', e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
                  />
                </div>
                <input
                  type="color"
                  value={config.brandColor}
                  onChange={(e) => handleUpdate('brandColor', e.target.value)}
                  className="w-12 h-12 rounded-xl border-none bg-transparent cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Frequently Asked Questions</label>
              <button 
                onClick={() => {
                  const newFaq = [...(config.faq || [])];
                  newFaq.push({ id: Date.now(), question: "New Question", answer: "New Answer" });
                  handleUpdate('faq', newFaq);
                }}
                className="p-1.5 bg-brand/10 text-brand rounded-lg hover:bg-brand/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {(config.faq || []).map((item: any, index: number) => (
                <div key={item.id} className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Question {index + 1}</span>
                    <button 
                      onClick={() => {
                        const newFaq = config.faq.filter((_: any, i: number) => i !== index);
                        handleUpdate('faq', newFaq);
                      }}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => {
                      const newFaq = [...config.faq];
                      newFaq[index].question = e.target.value;
                      handleUpdate('faq', newFaq);
                    }}
                    placeholder="Question"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-brand outline-none transition-colors"
                  />
                  <textarea
                    value={item.answer}
                    onChange={(e) => {
                      const newFaq = [...config.faq];
                      newFaq[index].answer = e.target.value;
                      handleUpdate('faq', newFaq);
                    }}
                    placeholder="Answer"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-brand outline-none transition-colors min-h-[60px]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'footer' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Footer Description</label>
              <textarea
                value={config.footer.description}
                onChange={(e) => handleUpdate('footer.description', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Copyright Text</label>
              <input
                type="text"
                value={config.footer.copyright}
                onChange={(e) => handleUpdate('footer.copyright', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Social Links</label>
              {config.footer.socials.map((social: any, index: number) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={social.name}
                    onChange={(e) => {
                      const newSocials = [...config.footer.socials];
                      newSocials[index].name = e.target.value;
                      handleUpdate('footer.socials', newSocials);
                    }}
                    placeholder="Platform"
                    className="w-1/3 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-brand outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={social.url}
                    onChange={(e) => {
                      const newSocials = [...config.footer.socials];
                      newSocials[index].url = e.target.value;
                      handleUpdate('footer.socials', newSocials);
                    }}
                    placeholder="URL"
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-brand outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="space-y-8">
            {['about', 'privacy', 'terms', 'contact'].map((pageKey) => (
              <div key={pageKey} className="space-y-6 pb-8 border-b border-white/10 last:border-0">
                <h3 className="text-sm font-bold text-white capitalize">{pageKey.replace('-', ' ')} Page</h3>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Page Title</label>
                  <input
                    type="text"
                    value={config.pages?.[pageKey]?.title || ''}
                    onChange={(e) => handleUpdate(`pages.${pageKey}.title`, e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Content</label>
                  <textarea
                    value={config.pages?.[pageKey]?.content || ''}
                    onChange={(e) => handleUpdate(`pages.${pageKey}.content`, e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors min-h-[200px]"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-8">
            {config.features.map((feature: any, index: number) => (
              <div key={feature.id} className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Feature {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const newFeatures = [...config.features];
                        if (index > 0) {
                          [newFeatures[index], newFeatures[index-1]] = [newFeatures[index-1], newFeatures[index]];
                          handleUpdate('features', newFeatures);
                        }
                      }}
                      className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        const newFeatures = [...config.features];
                        if (index < newFeatures.length - 1) {
                          [newFeatures[index], newFeatures[index+1]] = [newFeatures[index+1], newFeatures[index]];
                          handleUpdate('features', newFeatures);
                        }
                      }}
                      className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={feature.title}
                  onChange={(e) => {
                    const newFeatures = [...config.features];
                    newFeatures[index].title = e.target.value;
                    handleUpdate('features', newFeatures);
                  }}
                  placeholder="Title"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
                />
                <textarea
                  value={feature.description}
                  onChange={(e) => {
                    const newFeatures = [...config.features];
                    newFeatures[index].description = e.target.value;
                    handleUpdate('features', newFeatures);
                  }}
                  placeholder="Description"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors min-h-[80px]"
                />
                <div className="relative group aspect-video rounded-xl overflow-hidden border border-white/10">
                  <img src={feature.image} alt="Feature" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(`features.${index}.image`, e.target.files[0])}
                    />
                    <ImageIcon className="w-6 h-6 text-white" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'premium' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Premium Features</label>
            </div>
            {(config.premiumFeatures || []).map((feature: any, index: number) => (
              <div key={feature.id} className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-4">
                <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Premium {index + 1}</span>
                <input
                  type="text"
                  value={feature.title}
                  onChange={(e) => {
                    const newFeatures = [...config.premiumFeatures];
                    newFeatures[index].title = e.target.value;
                    handleUpdate('premiumFeatures', newFeatures);
                  }}
                  placeholder="Title"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
                />
                <textarea
                  value={feature.description}
                  onChange={(e) => {
                    const newFeatures = [...config.premiumFeatures];
                    newFeatures[index].description = e.target.value;
                    handleUpdate('premiumFeatures', newFeatures);
                  }}
                  placeholder="Description"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors min-h-[80px]"
                />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Icon (Lucide Name)</label>
                  <select
                    value={feature.icon}
                    onChange={(e) => {
                      const newFeatures = [...config.premiumFeatures];
                      newFeatures[index].icon = e.target.value;
                      handleUpdate('premiumFeatures', newFeatures);
                    }}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
                  >
                    <option value="FileText">FileText (Invoices)</option>
                    <option value="TrendingUp">TrendingUp (Forecast)</option>
                    <option value="Sparkles">Sparkles (Logo)</option>
                    <option value="Zap">Zap</option>
                    <option value="Shield">Shield</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'how' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Section Title</label>
              <input
                type="text"
                value={config.howItWorks.title}
                onChange={(e) => handleUpdate('howItWorks.title', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Section Subtitle</label>
              <input
                type="text"
                value={config.howItWorks.subtitle}
                onChange={(e) => handleUpdate('howItWorks.subtitle', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>
            <div className="space-y-4 pt-4 border-t border-white/5">
              {config.howItWorks.steps.map((step: any, index: number) => (
                <div key={step.id} className="space-y-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Step {index + 1}</span>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => {
                      const newSteps = [...config.howItWorks.steps];
                      newSteps[index].title = e.target.value;
                      handleUpdate('howItWorks.steps', newSteps);
                    }}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-brand outline-none transition-colors"
                  />
                  <textarea
                    value={step.description}
                    onChange={(e) => {
                      const newSteps = [...config.howItWorks.steps];
                      newSteps[index].description = e.target.value;
                      handleUpdate('howItWorks.steps', newSteps);
                    }}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-brand outline-none transition-colors min-h-[60px]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'testimonials' && (
          <div className="space-y-8">
            {config.testimonials.map((testimonial: any, index: number) => (
              <div key={testimonial.id} className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Review {index + 1}</span>
                </div>
                <input
                  type="text"
                  value={testimonial.name}
                  onChange={(e) => {
                    const newTestimonials = [...config.testimonials];
                    newTestimonials[index].name = e.target.value;
                    handleUpdate('testimonials', newTestimonials);
                  }}
                  placeholder="Name"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
                />
                <input
                  type="text"
                  value={testimonial.role}
                  onChange={(e) => {
                    const newTestimonials = [...config.testimonials];
                    newTestimonials[index].role = e.target.value;
                    handleUpdate('testimonials', newTestimonials);
                  }}
                  placeholder="Role"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
                />
                <textarea
                  value={testimonial.content}
                  onChange={(e) => {
                    const newTestimonials = [...config.testimonials];
                    newTestimonials[index].content = e.target.value;
                    handleUpdate('testimonials', newTestimonials);
                  }}
                  placeholder="Review content"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors min-h-[80px]"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 border-t border-white/10 bg-zinc-900/50 backdrop-blur-md">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-4 bg-brand text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
