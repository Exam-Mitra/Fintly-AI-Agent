import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock.jsx';

// Renders AI reply text as properly formatted Markdown — bold, italics, lists,
// headings, tables, and fenced code blocks (with syntax highlighting + copy button)
// all display correctly instead of showing raw '**', '#', or backticks as literal text.
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
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (inline) {
              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            }

            return <CodeBlock code={codeString} language={match ? match[1] : ''} />;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
