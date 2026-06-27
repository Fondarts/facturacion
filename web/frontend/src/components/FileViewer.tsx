import { useState, useEffect } from 'react';
import { FileText, Image, X, ExternalLink } from 'lucide-react';
import { getFileObjectUrl } from '../services/driveStorage';
import { t } from '../i18n';

interface FileViewerProps {
  fileUrl?: string;
  fileName?: string;
  driveFileId?: string; // archivo almacenado en Google Drive
}

export default function FileViewer({ fileUrl, fileName, driveFileId }: FileViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(fileUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Al abrir, si el archivo vive en Drive, descargarlo y crear un object URL.
  useEffect(() => {
    let revoked: string | null = null;
    if (isOpen && !fileUrl && driveFileId) {
      setLoading(true);
      setError('');
      getFileObjectUrl(driveFileId)
        .then((url) => {
          revoked = url;
          setResolvedUrl(url);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el archivo'))
        .finally(() => setLoading(false));
    }
    return () => {
      if (revoked) {
        URL.revokeObjectURL(revoked);
        setResolvedUrl(fileUrl || null);
      }
    };
  }, [isOpen, driveFileId, fileUrl]);

  if (!fileUrl && !driveFileId) {
    return null;
  }

  const isImage = fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  const isPdf = fileName?.toLowerCase().endsWith('.pdf');

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
      >
        {isPdf ? <FileText size={18} /> : <Image size={18} />}
        {isPdf ? t('viewer.viewPdf') : t('viewer.viewFile')}
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
                {isPdf ? <FileText size={20} className="text-emerald-400" /> : <Image size={20} className="text-emerald-400" />}
                <span className="text-white font-medium">{fileName || 'Archivo'}</span>
              </div>
              <div className="flex items-center gap-2">
                {resolvedUrl && (
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                    title="Abrir en nueva pestaña"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-auto max-h-[calc(100vh-120px)] min-w-[300px] min-h-[200px] flex items-center justify-center">
              {loading && (
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
              )}
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              {!loading && !error && resolvedUrl && (
                isPdf ? (
                  <iframe
                    src={resolvedUrl}
                    className="w-[80vw] h-[calc(100vh-200px)] rounded-lg border border-slate-700/50"
                    title={fileName || 'PDF'}
                  />
                ) : (
                  <img src={resolvedUrl} alt={fileName || 'Factura'} className="max-w-full h-auto rounded-lg" />
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
