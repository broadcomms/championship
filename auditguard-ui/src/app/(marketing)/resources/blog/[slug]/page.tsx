import ReactMarkdown from 'react-markdown';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { blogPosts } from '@/config/marketing';
import { StructuredData } from '@/components/marketing/seo/StructuredData';

const baseUrl = 'https://localhost:3000';

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = blogPosts.find((entry) => entry.slug === params.slug);
  if (!post) {
    return { title: 'Post not found' };
  }

  const url = `${baseUrl}/resources/blog/${post.slug}`;

  return {
    title: `${post.title} | AuditGuardX Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url,
      images: [{ url: post.heroImage }],
    },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogPosts.find((entry) => entry.slug === params.slug);

  if (!post) {
    notFound();
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    datePublished: post.publishedAt,
    image: post.heroImage,
    url: `${baseUrl}/resources/blog/${post.slug}`,
  };

  const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-12 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">{post.category}</p>
          <h1 className="mt-3 text-4xl font-bold text-gray-900">{post.title}</h1>
          <p className="mt-3 text-sm text-gray-500">
            {formattedDate} • {post.readingTime} • {post.author}
          </p>
          <div className="mt-8 rounded-3xl border border-gray-100 bg-white shadow-xl">
            <Image src={post.heroImage} alt={post.title} width={1200} height={630} className="h-auto w-full rounded-3xl" />
          </div>
          <article className="prose prose-lg mt-10 max-w-none">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </article>
        </div>
      </section>
      <StructuredData data={structuredData} />
    </div>
  );
}
