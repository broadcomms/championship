import { NextResponse } from 'next/server';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().min(2),
  plan: z.string().optional(),
  message: z.string().min(10),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = contactSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Placeholder for CRM/webhook integration.
  console.info('Marketing contact submission', parsed.data);

  return NextResponse.json({ success: true });
}
