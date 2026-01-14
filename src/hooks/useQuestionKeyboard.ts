import { useEffect, useCallback } from 'react';

interface Choice {
  position: number;
  text: string | null;
  imageUrl: string | null;
}

export interface UseQuestionKeyboardOptions {
  // Question context
  answerType: string;
  choices: Choice[];
  
  // Answer state
  selectedAnswer: number | string | number[] | null | undefined;
  hasAnswered: boolean;
  
  // Answer callbacks
  onSelectAnswer?: (answer: number | string | number[]) => void;
  onRevealAnswer?: () => void;
  
  // Navigation callbacks
  onPrevious?: () => void;
  onNext?: () => void;
  
  // Study-only callbacks
  onMarkMastered?: () => void;
  onMarkReview?: () => void;
  onToggleBookmark?: () => void;
  onToggleHelp?: () => void;
  
  // Feature flags
  enabled?: boolean;
  isStudyMode?: boolean;
  isLastQuestion?: boolean;
}

/**
 * Centralized keyboard shortcuts hook for both Study and Exam modes.
 * 
 * Shortcuts:
 * - A/B/C/D or 1/2/3/4: Select choice by position
 * - Y/N: Yes/No answer (for YES_NO type)
 * - Backspace: Undo last ORDER selection
 * - L: Reveal answer (study mode only)
 * - Enter: Submit INPUT answer (when in input) or mark mastered (study mode)
 * - ←/→: Previous/Next question
 * - Space: Mark as mastered & next (study mode only)
 * - I: Mark for review (study mode only)
 * - B: Toggle bookmark (study mode only)
 * - ?: Toggle shortcuts help
 */
export function useQuestionKeyboard({
  answerType,
  choices,
  selectedAnswer,
  hasAnswered,
  onSelectAnswer,
  onRevealAnswer,
  onPrevious,
  onNext,
  onMarkMastered,
  onMarkReview,
  onToggleBookmark,
  onToggleHelp,
  enabled = true,
  isStudyMode = false,
  isLastQuestion = false,
}: UseQuestionKeyboardOptions) {
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    
    const target = e.target as HTMLElement;
    const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    
    // Handle Enter key for INPUT type submissions
    if (e.key === 'Enter' && isInInput && answerType === 'INPUT') {
      // Don't prevent default - let the input handle it naturally
      // The input's onKeyDown will handle submission
      return;
    }
    
    // Don't trigger other shortcuts if user is typing in an input
    if (isInInput) {
      return;
    }

    const key = e.key.toLowerCase();

    // Answer selection shortcuts (only if not already answered in quiz mode)
    if (onSelectAnswer && !hasAnswered) {
      // Letter keys A-D for choices (must be single character)
      if (key.length === 1 && key >= 'a' && key <= 'd') {
        const position = key.charCodeAt(0) - 'a'.charCodeAt(0);
        if (position < choices.length) {
          e.preventDefault();
          handleChoiceSelection(position);
          return;
        }
      }
      
      // Number keys 1-4 for choices (must be single character)
      if (key.length === 1 && key >= '1' && key <= '4') {
        const position = parseInt(key) - 1;
        if (position < choices.length) {
          e.preventDefault();
          handleChoiceSelection(position);
          return;
        }
      }
      
      // Y/N for YES_NO type (must be single character)
      if (answerType === 'YES_NO' && key.length === 1) {
        if (key === 'y') {
          e.preventDefault();
          // Find the "Yes" choice (typically position 0)
          const yesChoice = choices.find(c => 
            c.text?.toLowerCase().includes('ja') || 
            c.text?.toLowerCase().includes('yes') ||
            c.position === 0
          );
          if (yesChoice) {
            onSelectAnswer(yesChoice.position);
          }
          return;
        }
        if (key === 'n') {
          e.preventDefault();
          // Find the "No" choice (typically position 1)
          const noChoice = choices.find(c => 
            c.text?.toLowerCase().includes('nee') || 
            c.text?.toLowerCase().includes('no') ||
            c.position === 1
          );
          if (noChoice) {
            onSelectAnswer(noChoice.position);
          }
          return;
        }
      }
      
      // Backspace for ORDER type - undo last selection
      if (e.key === 'Backspace' && answerType === 'ORDER') {
        e.preventDefault();
        const currentOrder = (selectedAnswer as number[]) || [];
        if (currentOrder.length > 0) {
          const newOrder = currentOrder.slice(0, -1);
          onSelectAnswer(newOrder);
        }
        return;
      }
    }
    
    // L key to reveal answer (study mode only, when answer not shown)
    if (key === 'l' && key.length === 1 && isStudyMode && !hasAnswered && onRevealAnswer) {
      e.preventDefault();
      onRevealAnswer();
      return;
    }

    // Navigation shortcuts
    if (e.key === 'ArrowLeft' && onPrevious) {
      e.preventDefault();
      onPrevious();
      return;
    }
    
    if (e.key === 'ArrowRight' && onNext) {
      e.preventDefault();
      onNext();
      return;
    }

    // Study mode only shortcuts
    if (isStudyMode) {
      // Space or Enter to mark as mastered and go next
      if ((e.key === ' ' || e.key === 'Enter') && onMarkMastered) {
        e.preventDefault();
        onMarkMastered();
        if (!isLastQuestion && onNext) {
          onNext();
        }
        return;
      }
      
      // I key to mark for review
      if (key === 'i' && onMarkReview) {
        e.preventDefault();
        onMarkReview();
        return;
      }
      
      // K key to toggle bookmark (K instead of B to avoid conflict with answer B)
      if (key === 'k' && onToggleBookmark) {
        e.preventDefault();
        onToggleBookmark();
        return;
      }
    }
    
    // ? key to toggle help (both modes)
    if (e.key === '?' && onToggleHelp) {
      e.preventDefault();
      onToggleHelp();
      return;
    }
  }, [
    enabled,
    answerType,
    choices,
    selectedAnswer,
    hasAnswered,
    onSelectAnswer,
    onRevealAnswer,
    onPrevious,
    onNext,
    onMarkMastered,
    onMarkReview,
    onToggleBookmark,
    onToggleHelp,
    isStudyMode,
    isLastQuestion,
  ]);

  // Helper to handle choice selection based on answer type
  const handleChoiceSelection = useCallback((position: number) => {
    if (!onSelectAnswer) return;
    
    if (answerType === 'ORDER') {
      // For ORDER, build up the sequence
      const currentOrder = (selectedAnswer as number[]) || [];
      // Don't add if already in the order
      if (!currentOrder.includes(position)) {
        onSelectAnswer([...currentOrder, position]);
      }
    } else {
      // For SINGLE_CHOICE, YES_NO - just select the position
      onSelectAnswer(position);
    }
  }, [answerType, selectedAnswer, onSelectAnswer]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Keyboard shortcuts configuration for help modals
 */
export const STUDY_SHORTCUTS_SECTIONS = [
  {
    title: 'Answer Selection',
    shortcuts: [
      { keys: ['A', 'B', 'C', 'D'], description: 'Select by letter' },
      { keys: ['1', '2', '3', '4'], description: 'Select by number' },
      { keys: ['Y', 'N'], description: 'Yes / No' },
      { keys: ['L'], description: 'Reveal answer' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['←'], description: 'Previous question' },
      { keys: ['→'], description: 'Next question' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Space'], description: 'Mark as mastered & next' },
      { keys: ['I'], description: 'Mark for review' },
      { keys: ['K'], description: 'Toggle bookmark' },
      { keys: ['?'], description: 'Show shortcuts' },
    ],
  },
];

export const EXAM_SHORTCUTS = [
  { keys: ['A', 'B', 'C', 'D'], description: 'Select answer by letter' },
  { keys: ['1', '2', '3', '4'], description: 'Select answer by number' },
  { keys: ['Y', 'N'], description: 'Yes/No answer' },
  { keys: ['←'], description: 'Previous question' },
  { keys: ['→'], description: 'Next question' },
  { keys: ['?'], description: 'Show shortcuts' },
];
