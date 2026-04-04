import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
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
    } catch (e) {
      setError('Failed to parse file');
    } finally {
      setIsUploading(false);
    }
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Upload Data</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a CSV, Excel, or JSON file to start analyzing with AI</p>
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
            isDragging ? 'bg-primary/20' : 'bg-muted'
          }`}>
            <Upload className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isUploading ? 'Processing...' : 'Drop your file here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx, .xls, and .json files up to 50MB</p>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}

      {/* Or use demo */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-center">
        <p className="text-xs text-muted-foreground mb-3">Or try with sample data</p>
        <button
          onClick={() => { loadDemo(); navigate('/'); }}
          className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 inline mr-2" />
          Load Demo Dataset
        </button>
      </motion.div>

      {/* Success */}
      {dataset && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-semibold text-foreground">{dataset.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} columns
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {dataset.columns.map(col => (
              <span key={col.name} className="px-2 py-1 rounded-md bg-muted text-xs font-mono text-muted-foreground">
                {col.name} <span className="text-primary">({col.type})</span>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
            >
              View Dashboard <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Ask AI <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default UploadPage;
