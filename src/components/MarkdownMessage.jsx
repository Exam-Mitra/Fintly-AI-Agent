import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders AI reply text as properly formatted Markdown — bold, italics, lists,
// headings, and fenced code blocks all display correctly instead of showing
// raw '**', '#', or backticks as literal characters.
export default function MarkdownMessage({ text }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
