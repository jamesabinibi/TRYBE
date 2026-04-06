import React, { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/utils';

export default function PublicPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiFetch('/api/landing-config');
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }
      } catch (err) {
        console.error('Failed to fetch config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pageData = config?.pages?.[pageId || ''];

  if (!pageData) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-brand/30 selection:text-brand font-sans" style={{ '--brand-color': '#ff4d00' } as any}>
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            {config?.logo?.favicon || config?.logo?.url ? (
              <img src={config.logo.favicon || config.logo.url} alt={config.logo.text} className="h-10 w-auto object-contain" />
            ) : (
              <>
                <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform">
                  <span className="font-serif italic">{config?.logo?.text?.charAt(0) || 'G'}</span>
                </div>
                <span className="text-xl font-bold tracking-tight">{config?.logo?.text || 'Gryndee'}</span>
              </>
            )}
          </Link>
          <Link 
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-brand transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{pageData.title}</h1>
            <div className="w-20 h-1.5 bg-brand rounded-full" />
          </div>
          
          <div className="prose prose-zinc prose-lg max-w-none prose-headings:font-bold prose-a:text-brand hover:prose-a:text-brand/80">
            {pageData.content.split('\n').map((paragraph: string, i: number) => (
              <p key={i} className="text-zinc-600 leading-relaxed mb-6">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-50 border-t border-zinc-100 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-zinc-500 text-sm font-medium">{config?.footer?.copyright}</p>
          <div className="flex items-center gap-6">
            {config?.footer?.socials?.map((social: any, i: number) => (
              <a key={i} href={social.url} className="text-sm font-medium text-zinc-500 hover:text-brand transition-colors">
                {social.name}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
