import { NextResponse } from 'next/server';

export function problemResponse(
  slug: string,
  title: string,
  status: number,
  detail: string,
  instance?: string,
) {
  return NextResponse.json(
    {
      type: `https://hatchme.cc/errors/${slug}`,
      title,
      status,
      detail,
      ...(instance ? { instance } : {}),
    },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}
