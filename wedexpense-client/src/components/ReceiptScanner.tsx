import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsCloudUpload, BsFileEarmarkImage, BsXCircle } from 'react-icons/bs';
import { scanReceipt } from '../api/client';

interface ScanResult {
  vendor_name?: string;
  amount?: number;
  date?: string;
  category?: string;
  receipt_url?: string;
  confidence?: number;
}

interface ReceiptScannerProps {
  onScanComplete: (result: ScanResult) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.pdf';
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onScanComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = useCallback((selectedFile: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload a JPG, PNG, or PDF file.');
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setError(`File size exceeds ${MAX_SIZE_MB}MB limit.`);
      return;
    }

    setFile(selectedFile);

    // Generate preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSetFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validateAndSetFile(dropped);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleScan = async () => {
    if (!file || scanning) return;
    try {
      setScanning(true);
      setError(null);
      const result = await scanReceipt(file);
      onScanComplete(result);
    } catch (err: any) {
      setError(err.message || 'Failed to scan receipt. Please enter details manually.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Upload area */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        animate={{
          borderColor: isDragOver
            ? 'rgba(124, 58, 237, 0.6)'
            : 'rgba(255, 255, 255, 0.15)',
        }}
        className={`relative border-2 border-dashed rounded-xl transition-colors ${
          file ? '' : 'cursor-pointer hover:border-primary-400/40 hover:bg-white/[0.03]'
        } ${isDragOver ? 'bg-primary/10' : 'bg-white/5 backdrop-blur-lg'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {!file ? (
            /* Empty upload state */
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-10 px-6"
            >
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-4">
                <BsCloudUpload className="text-2xl text-primary-300" />
              </div>
              <p className="text-sm font-medium text-white/70 mb-1">
                Drop receipt here or click to upload
              </p>
              <p className="text-xs text-white/40">
                JPG, PNG, or PDF &mdash; Max {MAX_SIZE_MB}MB
              </p>
            </motion.div>
          ) : (
            /* File selected state */
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="flex items-start gap-4">
                {/* Preview or file icon */}
                {preview ? (
                  <img
                    src={preview}
                    alt="Receipt preview"
                    className="w-24 h-24 object-cover rounded-lg border border-white/10"
                  />
                ) : (
                  <div className="w-24 h-24 bg-white/10 rounded-lg flex items-center justify-center border border-white/10">
                    <BsFileEarmarkImage className="text-3xl text-white/30" />
                  </div>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                  title="Remove file"
                >
                  <BsXCircle className="text-lg" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-sm text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Scan button */}
      {file && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleScan}
          disabled={scanning}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors shadow-lg ${
            scanning
              ? 'bg-primary/50 text-white/50 cursor-not-allowed shadow-none'
              : 'bg-primary hover:bg-primary-600 text-white shadow-primary/25'
          }`}
        >
          {scanning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning receipt...
            </span>
          ) : (
            'Scan Receipt'
          )}
        </motion.button>
      )}
    </div>
  );
};

export default ReceiptScanner;
