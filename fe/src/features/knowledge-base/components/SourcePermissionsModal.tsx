/**
 * @fileoverview Source permissions modal for knowledge base sources
 * Stub component after removing document storage feature
 */

import React from 'react';

export interface PermissionsSelectorProps {
  isPublic?: boolean;
  setIsPublic?: (value: boolean) => void;
  selectedTeamIds?: string[];
  setSelectedTeamIds?: (value: string[]) => void;
  selectedUserIds?: string[];
  setSelectedUserIds?: (value: string[]) => void;
  disabled?: boolean;
}

/**
 * Permissions selector component (stub)
 */
export const PermissionsSelector: React.FC<PermissionsSelectorProps> = () => {
  return (
    <div>
      {/* Stub component - implement permissions UI as needed */}
    </div>
  );
};

export interface SourcePermissionsModalProps {
  open: boolean;
  onClose: () => void;
  source: any;
  onSave: (id: string, permissions: any) => void;
}

/**
 * Source permissions modal component (stub)
 */
export const SourcePermissionsModal: React.FC<SourcePermissionsModalProps> = ({ open, onClose, source, onSave }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Permissions</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Permissions management feature is not available
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (source?.id) {
                onSave(source.id, {});
              }
              onClose();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
