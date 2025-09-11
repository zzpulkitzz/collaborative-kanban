import React from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: 'red' | 'blue' | 'green';
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmColor = 'red',
  isLoading = false
}) => {
  const getConfirmButtonClasses = () => {
    const baseClasses = 'px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
    
    switch (confirmColor) {
      case 'red':
        return `${baseClasses} bg-red-600 hover:bg-red-700 focus:ring-red-500`;
      case 'blue':
        return `${baseClasses} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
      case 'green':
        return `${baseClasses} bg-green-600 hover:bg-green-700 focus:ring-green-500`;
      default:
        return `${baseClasses} bg-red-600 hover:bg-red-700 focus:ring-red-500`;
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container to center the panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-2xl">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                confirmColor === 'red' ? 'bg-red-100' : 
                confirmColor === 'blue' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                <ExclamationTriangleIcon className={`w-6 h-6 ${
                  confirmColor === 'red' ? 'text-red-600' : 
                  confirmColor === 'blue' ? 'text-blue-600' : 'text-green-600'
                }`} />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg font-medium text-gray-900">
                  {title}
                </DialogTitle>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              {message}
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`${getConfirmButtonClasses()} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Please wait...</span>
                  </div>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ConfirmationModal;
