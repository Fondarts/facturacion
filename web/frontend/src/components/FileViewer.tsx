import { useState } from 'react';
import { FileText, Image, X, ExternalLink } from 'lucide-react';

interface FileViewerProps {
  fileUrl?: string;
  fileName?: string;
}

export default function FileViewer({ fileUrl, fileName }: FileViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!fileUrl) {
    return null;
  }

  const isImage = fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  const isPdf = fileName?.toLowerCase().endsWith('.pdf');

  if (!isImage && !isPdf) {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-700/50 transition-colors"
      >
        <ExternalLink size={18} />
        Ver archivo
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
      >
        {isImage ? <Image size={18} /> : <FileText size={18} />}
        Ver {isImage ? 'Imagen' : 'PDF'}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-w-6xl max-h-full bg-slate-900 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-800/50 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                {isImage ? <Image size={20} className="text-emerald-400" /> : <FileText size={20} className="text-emerald-400" />}
                <span className="text-white font-medium">{fileName || 'Archivo'}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                  title="Abrir en nueva pestaña"
                >
                  <ExternalLink size={18} />
                </a>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-auto max-h-[calc(100vh-120px)]">
              {isImage ? (
                <img
                  src={fileUrl}
                  alt={fileName || 'Factura'}
                  className="max-w-full h-auto rounded-lg"
                />
              ) : (
                <iframe
                  src={fileUrl}
                  className="w-full h-[calc(100vh-200px)] rounded-lg border border-slate-700/50"
                  title={fileName || 'PDF'}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


