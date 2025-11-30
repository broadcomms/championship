import { NextResponse } from 'next/server';
import { z } from 'zod';

const payloadSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  // Placeholder for future ESP integration (Mailchimp, Customer.io, etc.)
  console.info('Newsletter opt-in', parsed.data.email);

  return NextResponse.json({ success: true });
}
