import { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  onType?: () => void;
}

export function Typewriter({ text, speed = 20, onComplete, onType }: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState('');
  
  // Use refs to avoid re-triggering useEffect when parent callbacks change reference
  const onTypeRef = useRef(onType);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onTypeRef.current = onType;
  }, [onType]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    
    if (!text) return;

    const interval = setInterval(() => {
      const remaining = text.length - index;
      
      // Adapt chunk sizes dynamically to prevent CPU choke on long text responses
      let chunkSize = 1;
      if (remaining > 600) {
        chunkSize = 12;
      } else if (remaining > 300) {
        chunkSize = 6;
      } else if (remaining > 100) {
        chunkSize = 3;
      } else if (remaining > 40) {
        chunkSize = 2;
      }

      const nextIndex = Math.min(index + chunkSize, text.length);
      setDisplayedText(text.substring(0, nextIndex));
      index = nextIndex;

      if (onTypeRef.current) {
        onTypeRef.current();
      }

      if (index >= text.length) {
        clearInterval(interval);
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <div className="prose prose-sm prose-invert max-w-none text-zinc-200 leading-relaxed text-sm sm:text-[15px] animate-in fade-in duration-200">
      <MarkdownRenderer content={displayedText} />
    </div>
  );
}
