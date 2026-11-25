import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitLinks, useWikiLinks, WikiLinkButton } from './wiki/WikiLinks';

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const NO_LINK_TAGS = new Set(['a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** rehype-Plugin: ersetzt Namen aus Wiki, Gegenstands-Datenbank und Zauberbibliothek durch Verweise */
function rehypeWikiLinks(options: { split: (text: string) => ReturnType<typeof splitLinks> }) {
  const walk = (node: HastNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === 'text' && child.value) {
        return options
          .split(child.value)
          .map(
            (p): HastNode =>
              typeof p === 'string' ? { type: 'text', value: p } : { type: 'element', tagName: 'a', properties: { href: `#wl-${p.target.key}` }, children: [{ type: 'text', value: p.text }] },
          );
      }
      if (child.type === 'element' && !NO_LINK_TAGS.has(child.tagName ?? '')) walk(child);
      return [child];
    });
  };
  return (tree: HastNode) => walk(tree);
}

/**
 * Rendert Markdown sicher (kein Roh-HTML). Mit `links` werden Namen von Wiki-Einträgen, Rüstung/Waffen/Werkzeugen
 * und Zaubern automatisch verlinkt (je Ziel das erste Vorkommen; `selfKey` schließt den eigenen Eintrag aus).
 */
export function Markdown({
  children,
  className = '',
  links = false,
  selfKey,
  onTaskToggle,
  onInternalLink,
}: {
  children: string;
  className?: string;
  links?: boolean;
  selfKey?: string;
  /** Checklisten (`- [ ]`) abhakbar machen: Index des Kästchens in Textreihenfolge */
  onTaskToggle?: (index: number) => void;
  /** Interne Verweise (`#dm:…`) statt in neuem Tab öffnen */
  onInternalLink?: (href: string) => void;
}) {
  let taskIndex = 0;
  const linker = useWikiLinks(links);
  const seen = new Set<string>();
  return (
    <div className={`prose-spell ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={linker ? [[rehypeWikiLinks, { split: (text: string) => splitLinks(text, linker.data, seen, selfKey) }]] : []}
        components={{
          input: ({ node: _node, ...props }) => {
            if (props.type !== 'checkbox' || !onTaskToggle) return <input {...props} />;
            const index = taskIndex++;
            return <input type="checkbox" checked={!!props.checked} onChange={() => onTaskToggle(index)} className="cursor-pointer" />;
          },
          img: ({ node: _node, src, alt }) => <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} loading="lazy" className="my-2 max-h-[32rem] max-w-full rounded-lg border border-parchment-300 dark:border-night-700" />,
          a: ({ node: _node, href, children: content, ...props }) => {
            if (href?.startsWith('#dm:') && onInternalLink)
              return (
                <button type="button" className="wiki-link" onClick={() => onInternalLink(href)}>
                  {content}
                </button>
              );
            const key = href?.startsWith('#wl-') ? href.slice(4) : null;
            const target = key ? linker?.data.targets.get(key) : undefined;
            if (target && linker)
              return (
                <WikiLinkButton target={target} onOpen={linker.open}>
                  {content}
                </WikiLinkButton>
              );
            return (
              <a {...props} href={href} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
