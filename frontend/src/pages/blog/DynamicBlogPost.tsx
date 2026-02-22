import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import BlogPost from './BlogPost';

interface DynamicPost {
  blogTitle: string;
  blogSlug: string;
  blogBody: string;
  blogExcerpt: string;
  blogReadingTime: string;
  publishedAt: string;
}

export default function DynamicBlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<DynamicPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.getBlogPost(slug)
      .then((data) => setPost(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Post not found</h1>
          <p className="text-slate-500">{error || 'This blog post does not exist.'}</p>
          <a href="/blog" className="text-blue-600 hover:underline mt-4 inline-block">Back to Blog</a>
        </div>
      </div>
    );
  }

  const publishDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <BlogPost
      title={post.blogTitle}
      date={publishDate}
      readingTime={post.blogReadingTime || '5 min'}
      description={post.blogExcerpt}
      slug={post.blogSlug}
    >
      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(post.blogBody) }} />
    </BlogPost>
  );
}

// Convert markdown to HTML for rendering inside the prose container
function markdownToHtml(md: string): string {
  return md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Paragraphs (lines not starting with HTML tags)
    .replace(/^(?!<[a-z/])((?:(?!^$).)+)$/gm, '<p>$1</p>')
    // Clean up double spacing
    .replace(/\n{2,}/g, '\n');
}
