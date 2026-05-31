import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface CodeBlockProps {
  language?: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      (window as any).__allowProgrammaticCopy = true;
      await navigator.clipboard.writeText(value);
      (window as any).__allowProgrammaticCopy = false;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Gagal menyalin kode:', err);
      (window as any).__allowProgrammaticCopy = false;
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800/80 shadow-xl font-mono text-xs text-zinc-100 flex flex-col">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121214] border-b border-zinc-800 text-zinc-400 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="ml-1 text-[11px] font-medium tracking-wide uppercase text-zinc-500">
            {language || 'script'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors py-1 px-2.5 rounded hover:bg-zinc-800 text-[11px] font-medium cursor-pointer"
        >
          {copied ? (
            <>
              <i className="fa-solid fa-check text-emerald-400"></i>
              <span className="text-emerald-400 font-semibold">Tersalin!</span>
            </>
          ) : (
            <>
              <i className="fa-regular fa-copy"></i>
              <span>Salin Kode</span>
            </>
          )}
        </button>
      </div>
      {/* Code content - wrapped to prevent overflow and disable horizontal scrolling */}
      <div className="p-4 leading-relaxed text-zinc-200 bg-zinc-950/70">
        <pre className="m-0 p-0 border-0 shadow-none whitespace-pre-wrap break-words"><code className="whitespace-pre-wrap break-words font-mono">{value}</code></pre>
      </div>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        code(props) {
          const { className, children, ...rest } = props;
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children);
          const isInline = !match && !codeStr.includes('\n');
          
          if (isInline) {
            return (
              <code className="bg-zinc-850 px-2 py-0.5 rounded text-indigo-300 font-mono text-[13px] border border-zinc-800" {...rest}>
                {children}
              </code>
            );
          }

          const lang = match ? match[1] : '';
          const cleanCode = codeStr.replace(/\n$/, '');

          return <CodeBlock language={lang} value={cleanCode} />;
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
