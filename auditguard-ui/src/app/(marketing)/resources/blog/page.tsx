import Link from 'next/link';
import { blogPosts } from '@/config/marketing';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata = buildMarketingMetadata({
  title: 'Blog | AuditGuardX',
  description: 'Playbooks, benchmarks, and experiments for modern compliance teams.',
  path: '/resources/blog',
});

export default function BlogPage() {
  return (
    <div className="space-y-12 pt-28">
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Resources</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">Compliance intelligence hub</h1>
          <p className="mt-4 text-base text-gray-600">Fresh CRO experiments, AI workflows, and regulatory updates every week.</p>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-24 sm:px-6 lg:px-8">
          {blogPosts.map((post) => (
            <Link key={post.title} href={`/resources/blog/${post.slug}`} className="rounded-3xl border border-gray-100 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">{post.category}</p>
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">{post.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{post.excerpt}</p>
              <p className="mt-4 text-xs text-gray-500">
                {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {post.readingTime}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
