import { useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, Layers, File, X, Loader2 } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { useLocalData } from '@/features/data/context/localDataContext';
import type { DatasetRow } from '@/features/data/model/dataStore';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Button } from '@/shared/components/ui/button';

interface FilePreview {
  id: number;
  file: File;
  name: string;
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  status: 'pending' | 'parsing' | 'ready' | 'error';
  error?: string;
  parsedData?: { name: string; columns: Array<{ name: string; type: string; sample: string[] }>; rows: Record<string, unknown>[] };
}

let fileIdCounter = 0;

const UploadPage = () => {
  const { dataset, uploadFile, loadDemo } = useData();
  const { localDataset, importLocalDataset: importLocal } = useLocalData();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [showMergeMode, setShowMergeMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  const inferType = (rows: Record<string, unknown>[], colName: string): string => {
    const sample = rows.slice(0, 20).map(r => String(r[colName] ?? '')).filter(Boolean);
    if (sample.length === 0) return 'string';
    if (sample.every(v => !isNaN(Number(v)))) return 'number';
    if (sample.every(v => !isNaN(Date.parse(v)))) return 'date';
    return 'string';
  };

  const parseFile = async (file: File): Promise<{ name: string; columns: Array<{ name: string; type: string; sample: string[] }>; rows: Record<string, unknown>[] }> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'csv') {
      return new Promise((resolve, reject) => {
        Papa.parse(file, { header: true, dynamicTyping: false, skipEmptyLines: true, complete: (results) => {
          const rows = ((results.data || []) as Record<string, unknown>[]).filter(r => r && Object.keys(r).length > 0);
          const fields = results.meta?.fields || [];
          const columns = fields.map((name: string) => ({ name, type: inferType(rows, name), sample: rows.slice(0, 3).map(r => String(r[name] ?? '')) }));
          resolve({ name: file.name.replace(/\.(csv|xlsx|xls|json)$/i, ''), columns, rows });
        }, error: reject });
      });
    }
    
    if (ext === 'json') {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = (Array.isArray(parsed) ? parsed : [parsed]).filter(r => r && typeof r === 'object');
      const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
      const columns = fields.map(name => ({ name, type: inferType(rows, name), sample: rows.slice(0, 3).map(r => String(r[name] ?? '')) }));
      return { name: file.name.replace(/\.(csv|xlsx|xls|json)$/i, ''), columns, rows };
    }
    
    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]);
      const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
      const columns = fields.map(name => ({ name, type: inferType(rows, name), sample: rows.slice(0, 3).map(r => String(r[name] ?? '')) }));
      return { name: file.name.replace(/\.(csv|xlsx|xls|json)$/i, ''), columns, rows };
    }
    
    throw new Error('Unsupported file type');
  };

  const handleSingleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls', 'json'].includes(ext || '')) {
      setError('Please upload a CSV, Excel (.xlsx), or JSON file');
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      await uploadFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, [uploadFile]);

  const handleMultipleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    
    const validExts = ['csv', 'xlsx', 'xls', 'json'];
    const invalidFiles = fileArray.filter(f => !validExts.includes(f.name.split('.').pop()?.toLowerCase() || ''));
    if (invalidFiles.length > 0) {
      setError(`Invalid file type: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setError(null);
    setShowMergeMode(true);
    setIsProcessing(true);
    setProcessStatus('Parsing files...');

    const newPreviews: FilePreview[] = fileArray.map(file => ({
      id: ++fileIdCounter,
      file,
      name: file.name.replace(/\.(csv|xlsx|xls|json)$/i, ''),
      columns: [],
      rowCount: 0,
      status: 'parsing'
    }));
    
    setFilePreviews(newPreviews);

    for (let i = 0; i < fileArray.length; i++) {
      try {
        const result = await parseFile(fileArray[i]);
        setFilePreviews(prev => prev.map((p, idx) => {
          if (idx === i) {
            return {
              ...p,
              columns: result.columns,
              rowCount: result.rows.length,
              status: 'ready',
              parsedData: result
            };
          }
          return p;
        }));
      } catch (err) {
        setFilePreviews(prev => prev.map((p, idx) => {
          if (idx === i) {
            return { ...p, status: 'error', error: err instanceof Error ? err.message : 'Parse failed' };
          }
          return p;
        }));
      }
    }

    setIsProcessing(false);
    setProcessStatus('');
  }, []);

  const handleMergeUpload = useCallback(async () => {
    const readyFiles = filePreviews.filter(p => p.status === 'ready' && p.parsedData);
    if (readyFiles.length === 0) {
      setError('No valid files to merge');
      return;
    }

    setIsMerging(true);
    setProcessStatus('Merging datasets...');

    try {
      const parsedDatasets = readyFiles.map(p => p.parsedData);

      setProcessStatus('Sending to AI for analysis...');
      
      const response = await fetch('http://localhost:3001/api/datasets/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasets: parsedDatasets })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to merge datasets');
      }
      
      const state = await response.json();
      if (state.dataset) {
        window.location.href = '/';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge files');
    } finally {
      setIsMerging(false);
      setProcessStatus('');
    }
  }, [filePreviews]);

  const removeFile = useCallback((id: number) => {
    setFilePreviews(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearAllFiles = useCallback(() => {
    setFilePreviews([]);
    setShowMergeMode(false);
    setError(null);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length === 1) {
      handleSingleFile(files[0]);
    } else if (files && files.length > 1) {
      handleMultipleFiles(files);
    }
    e.target.value = '';
  };

  const handleMultiFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleMultipleFiles(files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (files.length === 1) {
        handleSingleFile(files[0]);
      } else {
        handleMultipleFiles(files);
      }
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-semibold text-foreground">Upload Data</h2>
        <p className="text-muted-foreground mt-1">Import your datasets for analysis</p>
      </motion.div>

      {!showMergeMode ? (
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              className="relative cursor-pointer rounded-xl border border-border/50 bg-card p-8 text-center transition-all hover:border-primary/50 hover:shadow-md"
            >
              <input
                id="single-file-input"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <label htmlFor="single-file-input" className="flex flex-col items-center gap-4 cursor-pointer">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
                  <File className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Single File</p>
                  <p className="mt-1 text-sm text-muted-foreground">Upload one dataset</p>
                </div>
                <Button variant="outline" className="w-full max-w-xs rounded-lg">Select File</Button>
              </label>
            </motion.div>

            <motion.div
              className="relative cursor-pointer rounded-xl border border-primary/30 bg-primary/5 p-8 text-center transition-all hover:border-primary/50 hover:shadow-md"
            >
              <input
                id="multi-file-input"
                ref={multiFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                multiple
                className="hidden"
                onChange={handleMultiFileInputChange}
              />
              <label htmlFor="multi-file-input" className="flex flex-col items-center gap-4 cursor-pointer">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                  <Layers className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">Multiple Files</p>
                  <p className="mt-1 text-sm text-muted-foreground">Merge multiple datasets</p>
                </div>
                <Button className="w-full max-w-xs rounded-lg">Select Files</Button>
              </label>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-muted-foreground/50'
            }`}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Single file uploads directly • Multiple files go to merge mode
            </p>
          </motion.div>

          <div className="text-center text-sm text-muted-foreground">
            Supported formats: .CSV, .XLSX, .JSON
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/50 bg-card p-6 space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Merge Datasets</p>
                <p className="text-sm text-muted-foreground">
                  {filePreviews.length} files • {filePreviews.reduce((sum, p) => sum + p.rowCount, 0)} total rows
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={clearAllFiles} disabled={isMerging} className="rounded-lg gap-2">
              <X className="h-4 w-4" />
              Clear All
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filePreviews.map((preview) => (
              <motion.div 
                key={preview.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-lg border border-border/50 bg-muted/30 p-4"
              >
                <button
                  onClick={() => removeFile(preview.id)}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                  disabled={isMerging}
                >
                  <X className="h-4 w-4" />
                </button>
                
                <div className="flex items-center gap-3 mb-3">
                  {preview.status === 'parsing' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  {preview.status === 'ready' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {preview.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                  <span className="text-sm font-medium text-foreground truncate pr-6">
                    {preview.file.name}
                  </span>
                </div>
                
                {preview.status === 'ready' && (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Rows:</span>
                      <span className="text-foreground font-medium">{preview.rowCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Columns:</span>
                      <span className="text-foreground font-medium">{preview.columns.length}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {preview.columns.slice(0, 4).map((col, i) => (
                        <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{col.name}</span>
                      ))}
                      {preview.columns.length > 4 && (
                        <span className="px-2 py-0.5 text-[10px] text-muted-foreground">+{preview.columns.length - 4}</span>
                      )}
                    </div>
                  </div>
                )}
                
                {preview.status === 'error' && (
                  <p className="text-xs text-red-500">{preview.error}</p>
                )}
              </motion.div>
            ))}
          </div>

          {processStatus && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {processStatus}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button variant="outline" onClick={clearAllFiles} disabled={isMerging} className="rounded-lg">
              Cancel
            </Button>
            <Button 
              onClick={handleMergeUpload} 
              className="rounded-lg gap-2"
              disabled={isMerging || filePreviews.filter(p => p.status === 'ready').length === 0}
            >
              {isMerging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Merge & Analyze
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex justify-end">
        <Button variant="outline" onClick={async () => {
            try {
              await loadDemo();
              navigate('/');
            } catch (err) {
              console.error('Failed to load demo data:', err);
              alert('Failed to load demo data. Please try uploading a file instead.');
            }
          }} className="rounded-lg"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Use Demo Data
        </Button>
      </motion.div>

      {dataset && !showMergeMode && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/50 bg-card p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-6 pb-4 border-b border-border/50">
            <div>
              <p className="text-xl font-semibold text-foreground">{dataset.name}</p>
              <p className="text-sm text-muted-foreground mt-1">Dataset loaded and ready</p>
            </div>
            <div className="rounded-full bg-green-50 border border-green-200 px-4 py-2 text-sm font-medium text-green-700">Ready</div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Records</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{dataset.rowCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Columns</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{dataset.columns.length}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Detected Fields</p>
            <div className="flex flex-wrap gap-2">
              {dataset.columns.map((col) => (
                <span key={col.name} className="rounded-full bg-muted px-3 py-1.5 text-sm">
                  {col.name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate('/')} className="rounded-lg">Cancel</Button>
            <Button onClick={() => navigate('/analytics')} className="rounded-lg gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Proceed to Analytics
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default UploadPage;