import React from 'react';
import { Search as SearchIcon } from 'lucide-react';

interface SearchProps {
  className?: string;
}

export const Search: React.FC<SearchProps> = ({ className = '' }) => {
  return (
    <SearchIcon className={className} />
  );
}; 