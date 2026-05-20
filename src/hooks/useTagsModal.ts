import { useState, useCallback } from 'react';

export const useTagsModal = () => {
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);

  const openTagsModal = useCallback(() => {
    setIsTagsModalOpen(true);
  }, []);

  const closeTagsModal = useCallback(() => {
    setIsTagsModalOpen(false);
  }, []);

  return {
    isTagsModalOpen,
    openTagsModal,
    closeTagsModal
  };
}; 