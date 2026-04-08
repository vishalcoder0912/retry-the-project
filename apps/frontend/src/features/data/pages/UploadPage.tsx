import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { useNavigate } from 'react-router-dom';

const UploadPage = () => {
  const { dataset, uploadFile, loadDemo } = useData();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls', 'json'].includes(ext || '')) {
      setError('Please upload a CSV, Excel (.xlsx), or JSON file');
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      await uploadFile(file);
    } catch {
      setError('Failed to parse file');
    } finally {
      setIsUploading(false);
    }
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-10 py-10">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="terminal-label">3.0 Upload</p>
        <h2 className="mt-2 text-5xl uppercase tracking-[0.08em] text-foreground">File Ingestion Protocol</h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative cursor-pointer border border-border p-20 text-center transition-colors ${
          isDragging ? 'bg-secondary' : 'bg-card hover:bg-muted/50'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center border border-border">
            <Upload className="h-9 w-9 text-foreground" />
          </div>
          <div>
            <p className="text-3xl uppercase tracking-[0.08em] text-foreground">
              {isUploading ? 'Processing Dataset' : 'Drag & Drop Dataset'}
            </p>
            <p className="mt-3 text-sm uppercase tracking-[0.08em] text-muted-foreground">Supported formats: .CSV, .XLSX, .JSON</p>
          </div>
          <div className="terminal-button w-full max-w-xl justify-center py-4">Select File From System</div>
        </div>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 border border-destructive px-4 py-3 text-sm uppercase tracking-[0.08em] text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex justify-end">
        <button
          onClick={async () => {
            try {
              await loadDemo();
              navigate('/');
            } catch (err) {
              console.error('Failed to load demo data:', err);
              alert('Failed to load demo data. Please try uploading a file instead.');
            }
          }}
          className="terminal-button"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Use Demo Data
        </button>
      </motion.div>

      {dataset && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="terminal-panel space-y-6 p-8"
        >
          <div className="flex items-center justify-between gap-6 border-b border-border pb-6">
            <div>
              <p className="text-3xl uppercase tracking-[0.06em] text-foreground">{dataset.name}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.08em] text-muted-foreground">Local registry file detected</p>
            </div>
            <div className="border border-success bg-success/10 px-4 py-2 text-sm uppercase tracking-[0.08em] text-success">Ready for Analysis</div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="terminal-label">Record Count</p>
              <p className="mt-3 text-4xl uppercase tracking-[0.08em] text-foreground">{dataset.rowCount.toLocaleString()} Rows</p>
            </div>
            <div>
              <p className="terminal-label">Detection Status</p>
              <p className="mt-3 text-4xl uppercase tracking-[0.08em] text-foreground">{dataset.columns.length} Columns Found</p>
            </div>
          </div>

          <div>
            <p className="terminal-label mb-4">Detected Fields</p>
            <div className="flex flex-wrap gap-3">
              {dataset.columns.map((col) => (
                <span key={col.name} className="border border-border px-3 py-2 text-xs uppercase tracking-[0.08em] text-foreground">
                  {col.name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button onClick={() => navigate('/')} className="terminal-button">Cancel</button>
            <button
              onClick={() => navigate('/analytics')}
              className="terminal-button-inverse gap-2 px-6 py-4"
            >
              <CheckCircle2 className="h-4 w-4" />
              Initialize Upload Sequence
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default UploadPage;
