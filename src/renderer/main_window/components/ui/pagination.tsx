import React from "react";
import { Button } from "./button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  onPageChange,
  isLoading = false,
}) => {
  const itemsPerPage = 20; // Fixed at 20 items per page
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center px-4 py-3 border-t border-gray-200 bg-white rounded-b-xl">
      {/* Previous button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || isLoading}
        className="px-4 py-2 mr-2"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>

      {/* Page indicator with loading */}
      <div className="flex items-center mx-4 px-3 py-1 bg-gray-50 rounded-md min-w-[80px] justify-center">
        {isLoading ? (
          <div className="flex items-center">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Next button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages || isLoading}
        className="px-4 py-2"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
};