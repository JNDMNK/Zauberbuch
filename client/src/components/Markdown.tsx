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
export function Markdown({ children, className = '', links = false, selfKey }: { children: string; className?: string; links?: boolean; selfKey?: string }) {
  const linker = useWikiLinks(links);
  const seen = new Set<string>();
  return (
    <div className={`prose-spell ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={linker ? [[rehypeWikiLinks, { split: (text: string) => splitLinks(text, linker.data, seen, selfKey) }]] : []}
        components={{
          a: ({ node: _node, href, children: content, ...props }) => {
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
