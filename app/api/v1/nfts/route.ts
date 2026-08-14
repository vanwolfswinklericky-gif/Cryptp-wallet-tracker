// app/api/v1/nfts/route.ts

import { NextRequest } from 'next/server';
import { GET as apiGet } from '@/api/routes';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = '/api/v1/nfts';
  
  const newRequest = new NextRequest(url.toString(), request);
  return apiGet(newRequest);
}