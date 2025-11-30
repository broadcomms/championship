import Image from 'next/image';
import { customerLogos } from '@/config/marketing';

export function LogoGrid() {
  return (
    <section className="border-y border-gray-100 bg-white/90">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-gray-500">
          Trusted by 3,000+ organizations
        </p>
        <div className="mt-8 grid grid-cols-2 gap-6 text-center text-gray-500 sm:grid-cols-3 lg:grid-cols-6">
          {customerLogos.map((logo) => (
            <div
              key={logo.name}
              className="flex flex-col items-center rounded-2xl border border-gray-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-400 transition hover:border-blue-200 hover:text-blue-600"
            >
              <Image src={logo.logo} alt={logo.name} width={120} height={32} className="object-contain" />
              <span className="mt-2 text-[11px] uppercase tracking-widest text-gray-400">{logo.tagline}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
