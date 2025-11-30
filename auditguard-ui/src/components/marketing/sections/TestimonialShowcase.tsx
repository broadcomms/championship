import { testimonialContent } from '@/config/marketing';

export function TestimonialShowcase() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Social Proof</p>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">What compliance leaders are saying</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonialContent.map((testimonial) => (
            <figure key={testimonial.author} className="rounded-3xl border border-gray-100 bg-gray-50/80 p-6 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">“{testimonial.quote}”</div>
              <figcaption className="mt-6 text-sm text-gray-600">
                <p className="font-semibold text-gray-900">{testimonial.author}</p>
                <p>{testimonial.title}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
