// app/api/v1/wallet/[address]/route.ts

import { NextRequest } from 'next/server';
import { GET as apiGet } from '@/api/routes';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  // Rewrite the URL to include the address
  const url = new URL(request.url);
  url.pathname = `/api/v1/wallet/${params.address}`;
  
  const newRequest = new NextRequest(url.toString(), request);
  return apiGet(newRequest);
}