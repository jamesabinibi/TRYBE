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
  Edit3,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface LandingCMSProps {
  config: any;
  onSave: (newConfig: any) => Promise<void>;
  onClose: () => void;
}

export default function LandingCMS({ config: initialConfig, onSave, onClose }: LandingCMSProps) {
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'hero' | 'features' | 'how' | 'testimonials' | 'logo'>('hero');

  const handleUpdate = (path: string, value: any) => {
    const newConfig = { ...config };
    const parts = path.split('.');
    let current = newConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    setConfig(newConfig);
  };

  const handleImageUpload = async (path: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': localStorage.getItem('userId') || '0'
          },
          body: JSON.stringify({ image: base64, folder: 'landing' })
        });
        const data = await res.json();
        if (data.url) {
          handleUpdate(path, data.url);
          toast.success('Image uploaded successfully');
        } else {
          toast.error('Upload failed');
        }
      } catch (err) {
        toast.error('Upload failed');
      }
    };
    reader.readAsDataURL(file);
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
    <div className="fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-white/10 z-[60] shadow-2xl flex flex-col">
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-brand" />
          <h2 className="text-lg font-bold text-white">Landing CMS</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar">
        {[
          { id: 'hero', label: 'Hero' },
          { id: 'logo', label: 'Logo' },
          { id: 'features', label: 'Features' },
          { id: 'how', label: 'How' },
          { id: 'testimonials', label: 'Reviews' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Hero Image</label>
              <div className="relative group aspect-video rounded-xl overflow-hidden border border-white/10">
                <img src={config.hero.image} alt="Hero" className="w-full h-full object-cover" />
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Logo Text</label>
              <input
                type="text"
                value={config.logo.text}
                onChange={(e) => handleUpdate('logo.text', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-brand outline-none transition-colors"
              />
            </div>
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
                  <img src={feature.image} alt="Feature" className="w-full h-full object-cover" />
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
