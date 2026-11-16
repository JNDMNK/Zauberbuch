import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Rendert Markdown sicher (kein Roh-HTML). */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-spell ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
