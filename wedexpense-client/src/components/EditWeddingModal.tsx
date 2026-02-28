import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsXLg } from 'react-icons/bs';
import { updateWedding } from '../api/client';

interface Props {
  wedding: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EditWeddingModal: React.FC<Props> = ({ wedding, isOpen, onClose, onSaved }) => {
  const [form, setForm] = useState({
    wedding_name: wedding?.wedding_name || '',
    total_budget: wedding?.total_budget?.toString() || '',
    start_date: wedding?.start_date || wedding?.wedding_date || '',
    end_date: wedding?.end_date || '',
    bride_name: wedding?.bride_name || '',
    groom_name: wedding?.groom_name || '',
    venue_city: wedding?.venue_city || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.wedding_name.trim()) return;
    try {
      setSaving(true);
      setError('');
      await updateWedding(wedding.ROWID, {
        ...form,
        total_budget: parseFloat(form.total_budget) || 0,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update wedding');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-dark-100 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Edit Wedding</h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                <BsXLg />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Wedding Name *</label>
                <input name="wedding_name" value={form.wedding_name} onChange={handleChange} required className={inputClass} />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Total Budget</label>
                <input type="number" name="total_budget" value={form.total_budget} onChange={handleChange} min="0" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">From Date</label>
                  <input type="date" name="start_date" value={form.start_date} onChange={handleChange} className={`${inputClass} [color-scheme:dark]`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">To Date</label>
                  <input type="date" name="end_date" value={form.end_date} onChange={handleChange} min={form.start_date} className={`${inputClass} [color-scheme:dark]`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Bride Name</label>
                  <input name="bride_name" value={form.bride_name} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Groom Name</label>
                  <input name="groom_name" value={form.groom_name} onChange={handleChange} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Venue City</label>
                <input name="venue_city" value={form.venue_city} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                onClick={handleSave}
                disabled={saving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EditWeddingModal;
