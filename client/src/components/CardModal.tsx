import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
}

interface Card {
  id: string;
  title: string;
  description?: string;
  position: number;
  columnId: string;
  assigneeId?: string;
  assigneeEmail?: string;
  creatorId?: string;
  dueDate?: Date;
  labels?: string[];
  priority: 'low' | 'medium' | 'high';
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit'; // ✅ New mode prop
  card?: Card | null; // ✅ Optional for create mode
  columnId?: string; // ✅ Required for create mode
  onCreate?: (cardData: Partial<Card>) => Promise<boolean>; // ✅ For creating
  onUpdate?: (cardId: string, updates: Partial<Card>) => Promise<boolean>; // ✅ For updating
  isLoading?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'green' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'red' },
];

const CardModal: React.FC<CardModalProps> = ({ 
  isOpen, 
  onClose, 
  mode,
  card,
  columnId,
  onCreate,
  onUpdate, 
  isLoading = false 
}) => {
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigneeEmail: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    labels: [] as string[],
  });

  const [newLabel, setNewLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when card changes
  useEffect(() => {
    if (mode === 'edit' && card) {
      // Edit mode - populate with existing card data
      setFormData({
        title: card.title || '',
        description: card.description || '',
        assigneeEmail: card.assigneeEmail || '',
        dueDate: card.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : '',
        priority: card.priority || 'medium',
        labels: card.labels || [],
      });
    } else {
      // Create mode - reset form
      setFormData({
        title: '',
        description: '',
        assigneeEmail: '',
        dueDate: '',
        priority: 'medium',
        labels: [],
      });
    }
  }, [mode, card, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const cardData: Partial<Card> = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      assigneeEmail: formData.assigneeEmail.trim() || undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      priority: formData.priority,
      labels: formData.labels,
    };

    try {
      let success = false;

      if (mode === 'create') {
        // Create new card
        if (onCreate && columnId) {
          success = await onCreate({ ...cardData, columnId });
        }
      } else {
        // Update existing card
        if (onUpdate && card) {
          success = await onUpdate(card.id, cardData);
        }
      }

      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLabel = () => {
    if (newLabel.trim() && !formData.labels.includes(newLabel.trim())) {
      setFormData(prev => ({
        ...prev,
        labels: [...prev.labels, newLabel.trim()]
      }));
      setNewLabel('');
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.filter(label => label !== labelToRemove)
    }));
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  // Modal title based on mode
  const modalTitle = mode === 'create' ? 'Create New Card' : 'Edit Card';
  const submitButtonText = mode === 'create' ? 'Create Card' : 'Update Card';

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              {modalTitle}
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Card Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Card Title *
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="input-field text-lg font-semibold"
                required
                maxLength={100}
                placeholder="Enter card title..."
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.title.length}/100 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input-field resize-none"
                rows={4}
                maxLength={1000}
                placeholder="Add a more detailed description..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.description.length}/1000 characters
              </p>
            </div>

            {/* Priority and Due Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="input-field"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="input-field"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Assignee Email */}
            <div>
              <label htmlFor="assigneeEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Assignee Email
              </label>
              <input
                id="assigneeEmail"
                type="email"
                value={formData.assigneeEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, assigneeEmail: e.target.value }))}
                className="input-field"
                placeholder="Enter assignee's email address..."
              />
              <p className="text-xs text-gray-500 mt-1">
                The person who will be responsible for this card
              </p>
            </div>

            {/* Labels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Labels
              </label>
              
              {/* Add Label Input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Add a label..."
                  className="input-field flex-1"
                  maxLength={20}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLabel();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddLabel}
                  disabled={!newLabel.trim() || formData.labels.includes(newLabel.trim())}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Existing Labels */}
              {formData.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.labels.map((label, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full border border-purple-200"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(label)}
                        className="ml-1 text-purple-600 hover:text-purple-800"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.title.trim() || isSubmitting}
                className={`btn-primary ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{mode === 'create' ? 'Creating...' : 'Updating...'}</span>
                  </div>
                ) : (
                  submitButtonText
                )}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default CardModal;
